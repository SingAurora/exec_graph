package action

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/submission"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/graphguide"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 通过事务端口确认行动和文档事实。
type Service struct{ store Store }

// New 注入行动事务仓储。
func New(store Store) *Service { return &Service{store: store} }

// Create 在图锁内校验来源、生成归属、编号和文档后发布；幂等记录与事实原子提交。
func (s *Service) Create(ctx context.Context, actor identity.Actor, key string, input CreateActionInput) (catalogue.ActionView, error) {
	var out catalogue.ActionView
	if !id.Valid(input.GraphID) || !id.Valid(input.GenerationID) || len(input.Images) > constants.ActionImageLimit {
		return out, fault.New(fault.Invalid, "发布参数不合法")
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		var err error
		out, err = submission.Run(tx, "actions/create", key, input, func() (catalogue.ActionView, error) {
			return publish(tx, actor, input)
		})
		return err
	})
	return out, err
}

func publish(tx Transaction, actor identity.Actor, input CreateActionInput) (catalogue.ActionView, error) {
	var zero catalogue.ActionView
	graph, err := tx.Graph(input.GraphID)
	if err != nil {
		return zero, err
	}
	sources, count, level, err := ResolveSources(graph, input)
	if err != nil {
		return zero, err
	}
	generation, err := tx.Generation(input.GenerationID)
	if err != nil {
		return zero, err
	}
	if err := validateGeneration(generation, actor.UserID); err != nil {
		return zero, err
	}
	if generation.RequesterID != actor.UserID || generation.ConversationOwnerID != actor.UserID {
		return zero, fault.New(fault.Forbidden, "不能确认他人的生成结果")
	}
	if generation.GraphID != graph.ID || generation.Mode != "action" || generation.ConversationNodeID != "" || generation.Guide != graph.Guide || !sameSources(sources, generation.Sources) {
		return zero, fault.New(fault.Conflict, "生成结果与当前发布背景不一致，请重新生成")
	}
	if strings.TrimSpace(generation.Title) == "" || utf8.RuneCountInString(generation.Title) > constants.ActionTitleLimit || strings.TrimSpace(generation.Objective) == "" || utf8.RuneCountInString(generation.Objective) > constants.ActionContentLimit {
		return zero, fault.New(fault.Conflict, "生成文稿不完整或超过长度限制")
	}
	if err := validateGenerationImages(generation.Objective, input.Images); err != nil {
		return zero, err
	}
	seen := map[string]bool{}
	for _, image := range input.Images {
		if seen[image.AssetID] || utf8.RuneCountInString(image.Alt) > constants.ImageAltLimit {
			return zero, fault.New(fault.Invalid, "配图重复或备注过长")
		}
		seen[image.AssetID] = true
		if err := tx.CheckAssets(&image.AssetID); err != nil {
			return zero, err
		}
	}
	node := Publication{ID: id.New(), ActorID: actor.UserID, GraphID: graph.ID, Number: publicationNumber(graph, sources), Level: level, HistoryCount: count, Guide: graphguide.ForMode(graph.Guide, "action"), Generation: generation, Sources: sources, Images: input.Images, CreatedAt: time.Now().UTC()}
	if err := tx.Publish(node); err != nil {
		return zero, err
	}
	// 有主要来源时直接继承其已发布表达/约定；自己的来源只承接行动，不继承自己的约定。
	expressionVersionID, agreementVersionID := inheritedDocumentIDs(sources)
	if len(sources) > 0 && primarySourceAuthor(graph, sources[0].NodeID) == actor.UserID {
		agreementVersionID = ""
	}
	if err := tx.InitializeNodeDocuments(graph.ID, node.ID, expressionVersionID, agreementVersionID); err != nil {
		return zero, err
	}
	if err := tx.Confirm(generation.ID, node.ID, true); err != nil {
		return zero, err
	}
	return tx.View(node.ID)
}

// publicationNumber 在整张图被删空后重新从 1 开始根节点编号，避免 next_node_number
// 遗留值触发表约束；图内已有节点时仍严格使用持锁分配的下一个编号。
func publicationNumber(graph Graph, sources []GenerationSource) uint32 {
	if len(sources) == 0 && len(graph.Nodes) == 0 {
		return 1
	}
	return graph.NextNumber
}

func editable(tx Transaction, uuid string, expected uint32) (Graph, Node, error) {
	graphID, err := tx.NodeGraph(uuid)
	if err != nil {
		return Graph{}, Node{}, err
	}
	graph, err := tx.Graph(graphID)
	if err != nil {
		return Graph{}, Node{}, err
	}
	node, err := EditableNode(graph, uuid, expected)
	return graph, node, err
}

// UpdateAgreement 只有作者可以整理尚未被引用的终点。
func (s *Service) UpdateAgreement(ctx context.Context, actor identity.Actor, input UpdateAgreementInput) (catalogue.ActionView, error) {
	var out catalogue.ActionView
	if !id.Valid(input.NodeID) || input.ExpectedVersion == 0 || (input.GenerationID != "" && !id.Valid(input.GenerationID)) {
		return out, fault.New(fault.Invalid, "节点或版本不合法")
	}
	if input.GenerationID == "" {
		if err := ValidateDocument(input.Document, false); err != nil {
			return out, err
		}
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graph, node, err := editable(tx, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return err
		}
		if node.AuthorID != actor.UserID {
			return fault.New(fault.Forbidden, "只能修改自己的行动文档")
		}
		document, generationID := input.Document, ""
		if input.GenerationID != "" {
			generation, err := tx.Generation(input.GenerationID)
			if err != nil {
				return err
			}
			if err := validateGeneration(generation, actor.UserID); err != nil {
				return err
			}
			if generation.RequesterID != actor.UserID {
				return fault.New(fault.Forbidden, "不能确认他人的生成结果")
			}
			currentAgreement := DocumentUpdate{Mode: "clear"}
			if strings.TrimSpace(node.Agreement.Markdown) != "" {
				markdown := node.Agreement.Markdown
				currentAgreement = DocumentUpdate{Mode: "update", Markdown: &markdown}
			}
			if generation.Mode != "agreement" || generation.GraphID != graph.ID || generation.ConversationNodeID != node.ID || generation.BaseVersion != node.Version || generation.Guide != graph.Guide || !sameDocument(generation.Agreement, currentAgreement) {
				return fault.New(fault.Conflict, "约定生成背景已变化，请重新生成")
			}
			if err := ValidateDocument(generation.GeneratedAgreement, false); err != nil {
				return err
			}
			document, generationID = generation.GeneratedAgreement, generation.ID
		}
		if err := revise(tx, actor, graph.ID, node, "agreement", node.Agreement, document, generationID); err != nil {
			return err
		}
		if generationID != "" {
			if err := tx.Confirm(generationID, node.ID, false); err != nil {
				return err
			}
		}
		out, err = tx.View(input.NodeID)
		return err
	})
	return out, err
}

func sameDocument(left, right DocumentUpdate) bool {
	if left.Mode != right.Mode {
		return false
	}
	if left.Markdown == nil || right.Markdown == nil {
		return left.Markdown == nil && right.Markdown == nil
	}
	return *left.Markdown == *right.Markdown
}

// UpdateExpression 只采用本节点连续对话的服务端输出，行动事实和原始对话保持不变。
func (s *Service) UpdateExpression(ctx context.Context, actor identity.Actor, input UpdateExpressionInput) (catalogue.ActionView, error) {
	var out catalogue.ActionView
	if !id.Valid(input.NodeID) || !id.Valid(input.GenerationID) || input.ExpectedVersion == 0 {
		return out, fault.New(fault.Invalid, "表达修改参数不合法")
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graph, node, err := editable(tx, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return err
		}
		if node.AuthorID != actor.UserID {
			return fault.New(fault.Forbidden, "只能修改自己的表达")
		}
		generation, err := tx.Generation(input.GenerationID)
		if err != nil {
			return err
		}
		if err := validateGeneration(generation, actor.UserID); err != nil {
			return err
		}
		if generation.RequesterID != actor.UserID {
			return fault.New(fault.Forbidden, "不能确认他人的生成结果")
		}
		if generation.Mode != "expression" || generation.GraphID != graph.ID || generation.ConversationNodeID != node.ID || generation.BaseVersion != node.Version || generation.Guide != graph.Guide || generation.InheritedExpressionID != node.Expression.ID {
			return fault.New(fault.Conflict, "表达生成背景已变化，请重新生成")
		}
		if err := ValidateDocument(generation.Expression, false); err != nil {
			return err
		}
		if err := revise(tx, actor, graph.ID, node, "expression", node.Expression, generation.Expression, generation.ID); err != nil {
			return err
		}
		if err := tx.Confirm(generation.ID, node.ID, false); err != nil {
			return err
		}
		out, err = tx.View(node.ID)
		return err
	})
	return out, err
}

func revise(tx Transaction, actor identity.Actor, graphID string, node Node, kind string, previous Document, doc DocumentUpdate, generationID string) error {
	text := ""
	if doc.Markdown != nil {
		text = *doc.Markdown
	}
	if strings.TrimSpace(text) == strings.TrimSpace(previous.Markdown) {
		return fault.New(fault.Conflict, "内容未变化，无需保存")
	}
	change, number := "supplement", uint32(1)
	if strings.TrimSpace(previous.Markdown) != "" {
		change = "modify"
	}
	if doc.Mode == "clear" {
		change = "clear"
	}
	if previous.NodeID == node.ID {
		number = previous.Revision + 1
	}
	return tx.Revise(Revision{NodeID: node.ID, GraphID: graphID, Kind: kind, Previous: previous, Document: doc, GenerationID: generationID, ActorID: actor.UserID, ExpectedVersion: node.Version, Number: number, ChangeKind: change})
}

// PublishNodeDocument 将终端节点的 AI 草案发布为当前版本；被接续后不可再发布。
func (s *Service) PublishNodeDocument(ctx context.Context, actor identity.Actor, input PublishNodeDocumentInput) (catalogue.ActionView, error) {
	var out catalogue.ActionView
	if !id.Valid(input.NodeID) || input.ExpectedVersion == 0 || (input.Kind != "expression" && input.Kind != "agreement") {
		return out, fault.New(fault.Invalid, "节点或文档类型不合法")
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graph, node, err := editable(tx, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return err
		}
		if node.AuthorID != actor.UserID {
			return fault.New(fault.Forbidden, "只能发布自己的文档")
		}
		documents, err := tx.NodeDocuments(node.ID)
		if err != nil {
			return err
		}
		var draft string
		for _, document := range documents {
			if document.Kind == input.Kind {
				if document.Status != "draft" {
					return fault.New(fault.Conflict, "文档没有待发布的 AI 草案")
				}
				draft = strings.TrimSpace(document.DraftMarkdown)
				break
			}
		}
		if draft == "" {
			return fault.New(fault.Conflict, "文档草案为空，不能发布")
		}
		previous := node.Expression
		if input.Kind == "agreement" {
			previous = node.Agreement
		}
		markdown := draft
		if err := revise(tx, actor, graph.ID, node, input.Kind, previous, DocumentUpdate{Mode: "update", Markdown: &markdown}, ""); err != nil {
			return err
		}
		out, err = tx.View(node.ID)
		return err
	})
	return out, err
}

// NodeDocuments 只向节点作者返回待发布的 AI 草案；公开节点读取不暴露草案。
func (s *Service) NodeDocuments(ctx context.Context, actor identity.Actor, nodeID string) ([]NodeDocument, error) {
	if !id.Valid(nodeID) {
		return nil, fault.New(fault.Invalid, "节点不合法")
	}
	var out []NodeDocument
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graphID, err := tx.NodeGraph(nodeID)
		if err != nil {
			return err
		}
		graph, err := tx.Graph(graphID)
		if err != nil {
			return err
		}
		for _, node := range graph.Nodes {
			if node.ID != nodeID {
				continue
			}
			if node.AuthorID != actor.UserID {
				return fault.New(fault.Forbidden, "只能查看自己的节点文档")
			}
			out, err = tx.NodeDocuments(nodeID)
			return err
		}
		return fault.New(fault.NotFound, "行动不存在")
	})
	return out, err
}

// Delete 只允许作者删除尚未被接续的终端节点。
func (s *Service) Delete(ctx context.Context, actor identity.Actor, input DeleteNodeInput) error {
	if !id.Valid(input.NodeID) || input.ExpectedVersion == 0 {
		return fault.New(fault.Invalid, "节点或版本不合法")
	}
	return s.store.Within(ctx, actor, func(tx Transaction) error {
		graph, node, err := editable(tx, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return err
		}
		if node.AuthorID != actor.UserID {
			return fault.New(fault.Forbidden, "只能删除自己的行动节点")
		}
		return tx.DeleteNode(graph.ID, node.ID)
	})
}

// DocumentHistory 返回节点自行发布的表达/约定版本，不沿祖先继承。
func (s *Service) DocumentHistory(ctx context.Context, actor identity.Actor, nodeID string) ([]DocumentVersionView, error) {
	if !id.Valid(nodeID) {
		return nil, fault.New(fault.Invalid, "节点不合法")
	}
	var out []DocumentVersionView
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graphID, err := tx.NodeGraph(nodeID)
		if err != nil {
			return err
		}
		if _, err := tx.Graph(graphID); err != nil {
			return err
		}
		out, err = tx.DocumentHistory(nodeID)
		return err
	})
	return out, err
}

func primarySourceAuthor(graph Graph, nodeID string) string {
	for _, node := range graph.Nodes {
		if node.ID == nodeID {
			return node.AuthorID
		}
	}
	return ""
}
