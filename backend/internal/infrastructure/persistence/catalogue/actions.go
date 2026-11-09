package catalogue

import (
	"context"
	"errors"
	"fmt"

	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/aimodel"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/timezone"
	"gorm.io/gorm"
)

// Actions 读取单图上下文，所有表通过 UUID 逻辑关联。
func (r *Repository) Actions(ctx context.Context, value string) ([]app.ActionView, error) {
	graph, err := r.Graph(ctx, value)
	if err != nil {
		return nil, err
	}
	var nodes []model.ActionNode
	if err := r.db.WithContext(ctx).Where("graph_uuid = ?", graph.ID).Order("node_number").Find(&nodes).Error; err != nil {
		return nil, err
	}
	return r.actions(ctx, nodes)
}

// Action 读取单节点并排除已删除图。
func (r *Repository) Action(ctx context.Context, value string) (app.ActionView, error) {
	uuid, err := r.resolve(ctx, "action", value)
	if err != nil {
		return app.ActionView{}, err
	}
	var node model.ActionNode
	err = r.db.WithContext(ctx).Table("action_nodes AS n").Select("n.*").Joins("JOIN graphs g ON g.uuid = n.graph_uuid").Where("n.uuid = ? AND g.deleted_at IS NULL", uuid).Take(&node).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.ActionView{}, fault.New(fault.NotFound, "行动不存在")
	}
	if err != nil {
		return app.ActionView{}, err
	}
	views, err := r.actions(ctx, []model.ActionNode{node})
	if err != nil {
		return app.ActionView{}, err
	}
	return views[0], nil
}

func (r *Repository) actions(ctx context.Context, nodes []model.ActionNode) ([]app.ActionView, error) {
	result := make([]app.ActionView, 0, len(nodes))
	ids := []string{}
	for _, n := range nodes {
		ids = append(ids, n.UUID)
	}
	if len(ids) == 0 {
		return result, nil
	}
	db := r.db.WithContext(ctx)
	var references []model.ActionReference
	var states []model.DocumentState
	var nodeDocuments []model.NodeDocument
	var documents []model.DocumentVersion
	var images []model.ActionImage
	var conversations []model.AIConversation
	if err := db.Where("target_node_uuid IN ?", ids).Order("id").Find(&references).Error; err != nil {
		return nil, err
	}
	if err := db.Where("node_uuid IN ?", ids).Find(&states).Error; err != nil {
		return nil, err
	}
	if err := db.Where("node_uuid IN ?", ids).Find(&nodeDocuments).Error; err != nil {
		return nil, err
	}
	docIDs := []string{}
	for _, state := range states {
		if state.EffectiveVersionUUID != nil {
			docIDs = append(docIDs, *state.EffectiveVersionUUID)
		}
	}
	if len(docIDs) > 0 {
		if err := db.Where("uuid IN ?", docIDs).Find(&documents).Error; err != nil {
			return nil, err
		}
	}
	if err := db.Where("node_uuid IN ?", ids).Order("position").Find(&images).Error; err != nil {
		return nil, err
	}
	if err := db.Where("node_uuid IN ?", ids).Find(&conversations).Error; err != nil {
		return nil, err
	}
	byDocument := map[string]model.DocumentVersion{}
	for _, d := range documents {
		byDocument[d.UUID] = d
	}
	byNodeDocument := map[string]map[string]model.NodeDocument{}
	for _, document := range nodeDocuments {
		if byNodeDocument[document.NodeUUID] == nil {
			byNodeDocument[document.NodeUUID] = map[string]model.NodeDocument{}
		}
		byNodeDocument[document.NodeUUID][document.Kind] = document
	}
	convIDs := []string{}
	byConv := map[string]model.AIConversation{}
	for _, c := range conversations {
		convIDs = append(convIDs, c.UUID)
		byConv[c.UUID] = c
	}
	var messages []model.AIMessage
	if len(convIDs) > 0 {
		if err := db.Where("conversation_uuid IN ? AND confirmed_at IS NOT NULL", convIDs).Order("sequence_number").Find(&messages).Error; err != nil {
			return nil, err
		}
	}
	// AI 消息的模型不在消息表里，按生成记录的 output_message_uuid 还原；旧夹具和演示数据没有真实模型，留空由前端回退。
	aiMessageIDs := []string{}
	for _, message := range messages {
		if message.Speaker == "ai" {
			aiMessageIDs = append(aiMessageIDs, message.UUID)
		}
	}
	byOutputModel := map[string]string{}
	if len(aiMessageIDs) > 0 {
		var generations []model.AIGeneration
		if err := db.Select("mode", "model", "output_message_uuid").Where("output_message_uuid IN ?", aiMessageIDs).Find(&generations).Error; err != nil {
			return nil, err
		}
		for _, generation := range generations {
			if generation.OutputMessageUUID != nil {
				byOutputModel[*generation.OutputMessageUUID] = aimodel.ResponseModel(generation.Mode, generation.Model)
			}
		}
	}
	// 行动作者资料随行动返回，前端不再为了作者展示加载整份用户目录。
	authorIDs := make([]string, 0, len(nodes))
	seenAuthors := map[string]bool{}
	for _, n := range nodes {
		if !seenAuthors[n.AuthorUUID] {
			seenAuthors[n.AuthorUUID] = true
			authorIDs = append(authorIDs, n.AuthorUUID)
		}
	}
	var authorRows []model.User
	if len(authorIDs) > 0 {
		if err := db.Where("uuid IN ?", authorIDs).Find(&authorRows).Error; err != nil {
			return nil, fmt.Errorf("读取行动作者: %w", err)
		}
	}
	authorProfiles, err := r.profiles(ctx, authorRows)
	if err != nil {
		return nil, err
	}
	byAuthor := make(map[string]*app.ProfileView, len(authorProfiles))
	for i := range authorProfiles {
		byAuthor[authorProfiles[i].ID] = &authorProfiles[i]
	}
	byID := map[string]*app.ActionView{}
	for _, n := range nodes {
		result = append(result, app.ActionView{ID: n.UUID, GraphID: n.GraphUUID, Number: n.NodeNumber, AuthorID: n.AuthorUUID, Author: byAuthor[n.AuthorUUID], Title: n.Title, Markdown: n.ObjectiveMarkdown, ObjectiveMarkdown: n.ObjectiveMarkdown, Version: n.Version, CreatedAt: timezone.InChina(n.CreatedAt), Images: []app.Image{}, Conversation: []app.Message{}, ExpressionConversation: []app.Message{}, AgreementConversation: []app.Message{}, ReferenceAgreements: []app.Assessment{}, ContextSnapshot: &app.ContextSnapshot{DirectNodeIDs: []string{}, HistoryNodeCount: n.HistoryNodeCount, Guide: n.ContextGuideSnapshot}})
	}
	for i := range result {
		byID[result[i].ID] = &result[i]
		statuses := byNodeDocument[result[i].ID]
		if statuses == nil {
			// 旧节点没有节点文档行，按已发布兼容。
			result[i].ExpressionStatus, result[i].AgreementStatus, result[i].NodeReady = "published", "published", true
		} else {
			result[i].ExpressionStatus, result[i].AgreementStatus = statuses["expression"].Status, statuses["agreement"].Status
			result[i].NodeReady = result[i].ExpressionStatus == "published" && result[i].AgreementStatus == "published"
		}
	}
	for _, edge := range references {
		node := byID[edge.TargetNodeUUID]
		if edge.Kind == "primary" {
			node.ParentID = edge.SourceNodeUUID
		} else {
			node.MergedParentIDs = append(node.MergedParentIDs, edge.SourceNodeUUID)
		}
		node.ContextSnapshot.DirectNodeIDs = append(node.ContextSnapshot.DirectNodeIDs, edge.SourceNodeUUID)
		var complies *bool
		if edge.AgreementStatus == "satisfied" || edge.AgreementStatus == "exception" {
			value := edge.AgreementStatus == "satisfied"
			complies = &value
		}
		// 当前 UI 的过渡节点模型用“没有核对记录”表示未知；不能发送 null 后被当成 false。
		if complies != nil {
			node.ReferenceAgreements = append(node.ReferenceAgreements, app.Assessment{SourceID: edge.SourceNodeUUID, Complies: complies, ExceptionReason: edge.ExceptionReason})
		}
	}
	for _, s := range states {
		if s.EffectiveVersionUUID == nil {
			continue
		}
		document, ok := byDocument[*s.EffectiveVersionUUID]
		if !ok {
			return nil, fault.New(fault.Unavailable, "行动文档数据不完整")
		}
		node := byID[s.NodeUUID]
		text := document.Markdown
		var revision *app.Revision
		// 继承自父节点的版本只用于展示，不伪装成本节点的补充记录。
		if s.LocalVersionUUID != nil && (document.RevisionNumber > 1 || document.CreatedAt.After(node.CreatedAt)) {
			revision = &app.Revision{AuthorID: document.ActorUUID, CreatedAt: timezone.InChina(document.CreatedAt), Kind: document.ChangeKind}
		}
		if s.Kind == "expression" {
			node.ExpressionMarkdown = &text
			node.ExpressionSupplement = revision
		} else {
			node.AgreementMarkdown = &text
			node.AgreementSupplement = revision
		}
	}
	for _, image := range images {
		address := ""
		if u := MediaURL(image.AssetUUID); u != nil {
			address = *u
		} else if image.ExternalURL != nil {
			address = *image.ExternalURL
		}
		byID[image.NodeUUID].Images = append(byID[image.NodeUUID].Images, app.Image{AssetID: image.AssetUUID, URL: address, Alt: image.AltText})
	}
	for _, message := range messages {
		conv := byConv[message.ConversationUUID]
		if conv.NodeUUID == nil || conv.PublishedThroughSequence == nil {
			continue
		}
		node := byID[*conv.NodeUUID]
		view := app.Message{ID: message.UUID, Speaker: message.Speaker, Body: message.Body, Model: byOutputModel[message.UUID]}
		if message.AuthorUUID != nil {
			view.AuthorID = *message.AuthorUUID
		}
		switch conv.Kind {
		case "expression":
			node.ExpressionConversation = append(node.ExpressionConversation, view)
		case "agreement":
			node.AgreementConversation = append(node.AgreementConversation, view)
		case "action":
			node.Conversation = append(node.Conversation, view)
		}
	}
	return result, nil
}
