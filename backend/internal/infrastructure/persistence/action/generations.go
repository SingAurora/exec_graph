package action

import (
	"errors"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (t *actionTransaction) Generation(uuid string) (app.Generation, error) {
	var row model.AIGeneration
	if err := t.DB.Where("uuid = ?", uuid).Take(&row).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return app.Generation{}, fault.New(fault.NotFound, "生成结果不存在")
		}
		return app.Generation{}, err
	}
	var conversation model.AIConversation
	if err := t.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", row.ConversationUUID).Take(&conversation).Error; err != nil {
		return app.Generation{}, err
	}
	// 先锁对话，再重新读取生成，避免并发生成或确认时采用过期状态。
	if err := t.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", uuid).Take(&row).Error; err != nil {
		return app.Generation{}, err
	}
	var snapshots []model.GenerationSource
	if err := t.DB.Where("generation_uuid = ?", uuid).Order("CASE WHEN kind = 'primary' THEN 0 ELSE 1 END, id").Find(&snapshots).Error; err != nil {
		return app.Generation{}, err
	}
	result := app.Generation{ID: uuid, GraphID: row.GraphUUID, RequesterID: row.RequestedByUUID, Mode: row.Mode, ConversationOwnerID: conversation.OwnerUUID, Guide: row.ContextGuideSnapshot, Agreement: app.DocumentUpdate{Mode: row.DownstreamAgreementMode}, Status: row.Status, Confirmed: row.ConfirmedAt != nil, Completed: row.CompletedAt != nil, HasExpression: row.ExpressionMode != nil && row.ExpressionMarkdown != nil, ConversationID: conversation.UUID, ConversationGraphID: conversation.GraphUUID, NextMessageSequence: conversation.NextMessageSequence, InputThroughSequence: row.InputThroughSequence}
	if row.ExpressionMode != nil {
		result.Expression.Mode = *row.ExpressionMode
	}
	if row.InheritedExpressionVersionUUID != nil {
		result.InheritedExpressionID = *row.InheritedExpressionVersionUUID
	}
	if conversation.NodeUUID != nil {
		result.ConversationNodeID = *conversation.NodeUUID
	}
	if row.BaseNodeVersion != nil {
		result.BaseVersion = *row.BaseNodeVersion
	}
	if row.GeneratedTitle != nil {
		result.Title = *row.GeneratedTitle
	}
	if row.ObjectiveMarkdown != nil {
		result.Objective = *row.ObjectiveMarkdown
	}
	if result.Expression.Mode == "update" {
		result.Expression.Markdown = row.ExpressionMarkdown
	}
	if result.Agreement.Mode == "update" {
		result.Agreement.Markdown = row.DownstreamAgreementMarkdown
	}
	for _, source := range snapshots {
		var complies *bool
		if source.Complies != nil {
			value := *source.Complies == 1
			complies = &value
		}
		expressionID, agreementID := "", ""
		if source.SourceExpressionVersionUUID != nil {
			expressionID = *source.SourceExpressionVersionUUID
		}
		if source.SourceAgreementVersionUUID != nil {
			agreementID = *source.SourceAgreementVersionUUID
		}
		result.Sources = append(result.Sources, app.GenerationSource{GraphID: source.GraphUUID, NodeID: source.SourceNodeUUID, Kind: source.Kind, Version: source.SourceNodeVersion, ExpressionID: expressionID, AgreementID: agreementID, Complies: complies, ExceptionReason: source.ExceptionReason})
	}
	if err := t.messages(row, &result); err != nil {
		return result, err
	}
	return result, nil
}

func (t *actionTransaction) messages(row model.AIGeneration, result *app.Generation) error {
	if row.OutputMessageUUID != nil {
		var output model.AIMessage
		if err := t.DB.Where("uuid = ?", *row.OutputMessageUUID).Take(&output).Error; err != nil {
			return err
		}
		message := messageFact(output)
		result.Output = &message
	}
	var messages []model.AIMessage
	var used []model.GenerationMessage
	manifest := t.DB.Model(&model.GenerationMessage{}).Select("message_uuid").Where("generation_uuid = ?", row.UUID)
	if err := t.DB.Where("conversation_uuid = ? AND uuid IN (?)", row.ConversationUUID, manifest).Order("sequence_number").Find(&messages).Error; err != nil {
		return err
	}
	if err := t.DB.Where("generation_uuid = ?", row.UUID).Order("position").Find(&used).Error; err != nil {
		return err
	}
	var outputs []model.AIGeneration
	if err := t.DB.Where("conversation_uuid = ? AND output_message_uuid IS NOT NULL", row.ConversationUUID).Find(&outputs).Error; err != nil {
		return err
	}
	owners := map[string]string{}
	for _, output := range outputs {
		owners[*output.OutputMessageUUID] = output.RequestedByUUID
	}
	for _, message := range messages {
		fact := messageFact(message)
		fact.PrivateOwnerID = owners[message.UUID]
		result.Messages = append(result.Messages, fact)
	}
	for _, message := range used {
		result.UsedMessages = append(result.UsedMessages, app.GenerationInput{ConversationID: message.ConversationUUID, MessageID: message.MessageUUID, Position: message.Position})
	}
	var newer int64
	if err := t.DB.Model(&model.AIMessage{}).Where("conversation_uuid = ? AND sequence_number > ? AND speaker = ? AND author_uuid = ?", row.ConversationUUID, row.InputThroughSequence+1, "user", row.RequestedByUUID).Count(&newer).Error; err != nil {
		return err
	}
	result.HasNewerRequesterInput = newer > 0
	return nil
}

func messageFact(message model.AIMessage) app.ConversationMessage {
	authorID := ""
	if message.AuthorUUID != nil {
		authorID = *message.AuthorUUID
	}
	return app.ConversationMessage{ID: message.UUID, ConversationID: message.ConversationUUID, Sequence: message.SequenceNumber, Speaker: message.Speaker, AuthorID: authorID, Confirmed: message.ConfirmedAt != nil}
}

func (t *actionTransaction) Confirm(generationID, nodeID string, initial bool) error {
	var generation model.AIGeneration
	if err := t.DB.Where("uuid = ?", generationID).Take(&generation).Error; err != nil {
		return err
	}
	now := time.Now().UTC()
	if err := t.DB.Model(&model.AIGeneration{}).Where("uuid = ?", generationID).Update("confirmed_at", now).Error; err != nil {
		return err
	}
	used := t.DB.Model(&model.GenerationMessage{}).Select("message_uuid").Where("generation_uuid = ?", generationID)
	if err := t.DB.Model(&model.AIMessage{}).Where("conversation_uuid = ? AND confirmed_at IS NULL AND (uuid IN (?) OR uuid = ?)", generation.ConversationUUID, used, *generation.OutputMessageUUID).Update("confirmed_at", now).Error; err != nil {
		return err
	}
	if initial {
		boundary := generation.InputThroughSequence + 1
		return t.DB.Model(&model.AIConversation{}).Where("uuid = ?", generation.ConversationUUID).Updates(model.AIConversation{NodeUUID: &nodeID, PublishedThroughSequence: &boundary, UpdatedAt: now}).Error
	}
	return nil
}
