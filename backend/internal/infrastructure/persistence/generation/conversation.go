package generation

import (
	"errors"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (t *generationTransaction) Conversation(input app.GenerateInput) (app.Conversation, error) {
	var row model.AIConversation
	query := t.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("graph_uuid = ?", input.GraphID)
	if input.Mode == "expression" {
		query = query.Where("node_uuid = ?", input.NodeID)
	} else {
		query = query.Where("uuid = ? AND owner_uuid = ? AND node_uuid IS NULL", input.ConversationID, t.Actor.UserID)
	}
	err := query.Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) && input.ConversationID == "" && input.Mode == "action" {
		row = model.AIConversation{UUID: id.New(), GraphUUID: input.GraphID, OwnerUUID: t.Actor.UserID, NextMessageSequence: 1, Version: 1}
		err = t.DB.Create(&row).Error
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.Conversation{}, fault.New(fault.NotFound, "对话不存在或不可使用")
	}
	if err != nil {
		return app.Conversation{}, err
	}
	if input.ConversationID != "" && row.UUID != input.ConversationID {
		return app.Conversation{}, fault.New(fault.Invalid, "对话与节点不一致")
	}
	now, code := time.Now().UTC(), "interrupted"
	if err := t.DB.Model(&model.AIGeneration{}).Where("conversation_uuid = ? AND status = ? AND created_at < ?", row.UUID, "pending", now.Add(-constants.AIPendingTimeout)).Select("Status", "ErrorCode", "CompletedAt").Updates(model.AIGeneration{Status: "failed", ErrorCode: &code, CompletedAt: &now}).Error; err != nil {
		return app.Conversation{}, err
	}
	var running int64
	if err := t.DB.Model(&model.AIGeneration{}).Where("conversation_uuid = ? AND status = ?", row.UUID, "pending").Count(&running).Error; err != nil {
		return app.Conversation{}, err
	}
	if running > 0 {
		return app.Conversation{}, fault.New(fault.Conflict, "这条对话正在整理，请稍后再试")
	}
	// AI 回复没有 author_uuid，必须通过生成发起者确定未确认回复的所有权。
	ownedOutputs := t.DB.Model(&model.AIGeneration{}).Select("output_message_uuid").Where("conversation_uuid = ? AND requested_by_uuid = ? AND output_message_uuid IS NOT NULL", row.UUID, t.Actor.UserID)
	var messages []model.AIMessage
	if err := t.DB.Where("conversation_uuid = ? AND (confirmed_at IS NOT NULL OR (speaker = ? AND author_uuid = ?) OR uuid IN (?))", row.UUID, "user", t.Actor.UserID, ownedOutputs).Order("sequence_number").Find(&messages).Error; err != nil {
		return app.Conversation{}, err
	}
	out := app.Conversation{ID: row.UUID, NextSequence: row.NextMessageSequence, Messages: []app.Message{}, MessageIDs: []string{}}
	for _, message := range messages {
		role := "user"
		if message.Speaker == "ai" {
			role = "assistant"
		}
		out.Messages = append(out.Messages, app.Message{Role: role, Content: message.Body})
		out.MessageIDs = append(out.MessageIDs, message.UUID)
	}
	var previous model.AIGeneration
	err = t.DB.Where("conversation_uuid = ? AND requested_by_uuid = ? AND status = ?", row.UUID, t.Actor.UserID, "succeeded").Order("id DESC").Take(&previous).Error
	if err == nil {
		view, err := t.view(previous)
		if err != nil {
			return out, err
		}
		out.PreviousDraft = view.Draft
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return out, err
	}
	return out, nil
}
