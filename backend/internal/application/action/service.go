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
	expectedInherited := ""
	if len(sources) > 0 {
		expectedInherited = sources[0].ExpressionID
	}
	if generation.InheritedExpressionID != expectedInherited {
		return zero, fault.New(fault.Conflict, "生成采用的继承表达已变化，请重新生成")
	}
	if strings.TrimSpace(generation.Title) == "" || utf8.RuneCountInString(generation.Title) > constants.ActionTitleLimit || strings.TrimSpace(generation.Objective) == "" || utf8.RuneCountInString(generation.Objective) > constants.DocumentLimit {
		return zero, fault.New(fault.Conflict, "生成文稿不完整或超过长度限制")
	}
	if err := ValidateDocument(generation.Expression, input.ParentID != ""); err != nil {
		return zero, err
	}
	if err := ValidateDocument(generation.Agreement, input.ParentID != ""); err != nil {
		return zero, err
	}
	seen := map[string]bool{}
	for _, image := range input.Images {
		if seen[image.AssetID] || utf8.RuneCountInString(image.Alt) > constants.ImageAltLimit {
			return zero, fault.New(fault.Invalid, "配图重复或描述过长")
		}
		seen[image.AssetID] = true
		if err := tx.CheckAssets(&image.AssetID); err != nil {
			return zero, err
		}
	}
	node := Publication{ID: id.New(), ActorID: actor.UserID, GraphID: graph.ID, Number: graph.NextNumber, Level: level, HistoryCount: count, Guide: graph.Guide, Generation: generation, Sources: sources, Images: input.Images, CreatedAt: time.Now().UTC()}
	if err := tx.Publish(node); err != nil {
		return zero, err
	}
	if err := tx.Confirm(generation.ID, node.ID, true); err != nil {
		return zero, err
	}
	return tx.View(node.ID)
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

// UpdateAgreement 任何已认证用户均可整理尚未被引用的终点，实际操作者留在新版本中。
func (s *Service) UpdateAgreement(ctx context.Context, actor identity.Actor, input UpdateAgreementInput) (catalogue.ActionView, error) {
	var out catalogue.ActionView
	if !id.Valid(input.NodeID) || input.ExpectedVersion == 0 {
		return out, fault.New(fault.Invalid, "节点或版本不合法")
	}
	if err := ValidateDocument(input.Document, false); err != nil {
		return out, err
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		graph, node, err := editable(tx, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return err
		}
		if err := revise(tx, actor, graph.ID, node, "agreement", node.Agreement, input.Document, ""); err != nil {
			return err
		}
		out, err = tx.View(input.NodeID)
		return err
	})
	return out, err
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
