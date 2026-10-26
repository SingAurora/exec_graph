package generation

import (
	"encoding/json"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func pointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func (t *generationTransaction) Reserve(p app.Pending) error {
	user := model.AIMessage{UUID: id.New(), ConversationUUID: p.Conversation.ID, SequenceNumber: p.Conversation.NextSequence, Speaker: "user", AuthorUUID: &p.ActorID, Body: p.InputMessage, CreatedAt: p.CreatedAt}
	if err := t.DB.Create(&user).Error; err != nil {
		return err
	}
	var base *uint32
	if p.Mode == "expression" {
		base = &p.ExpectedVersion
	}
	var agreement *string
	if p.Agreement.Mode != "inherit" {
		empty := ""
		agreement = &empty
		if p.Agreement.Markdown != nil {
			agreement = p.Agreement.Markdown
		}
	}
	row := model.AIGeneration{UUID: p.ID, ConversationUUID: p.Conversation.ID, GraphUUID: p.GraphID, RequestedByUUID: p.ActorID, RequestKey: p.RequestKey, Mode: p.Mode, Status: "pending", InputThroughSequence: user.SequenceNumber, BaseNodeVersion: base, InheritedExpressionVersionUUID: pointer(p.InheritedExpressionID), DownstreamAgreementMode: p.Agreement.Mode, DownstreamAgreementMarkdown: agreement, ContextGuideSnapshot: p.Guide, ContextSHA256: p.ContextDigest, Model: p.Model, PromptVersion: "action-v1", CreatedAt: p.CreatedAt}
	if err := t.DB.Create(&row).Error; err != nil {
		return err
	}
	for _, source := range p.Sources {
		if err := t.DB.Create(&model.GenerationSource{GraphUUID: p.GraphID, GenerationUUID: p.ID, SourceNodeUUID: source.NodeID, SourceNodeVersion: source.Version, Kind: source.Kind, SourceExpressionVersionUUID: pointer(source.ExpressionID), SourceAgreementVersionUUID: pointer(source.AgreementID)}).Error; err != nil {
			return err
		}
	}
	ids := append(append([]string{}, p.Conversation.MessageIDs...), user.UUID)
	for i, uuid := range ids {
		if err := t.DB.Create(&model.GenerationMessage{ConversationUUID: p.Conversation.ID, GenerationUUID: p.ID, MessageUUID: uuid, Position: uint32(i + 1)}).Error; err != nil {
			return err
		}
	}
	if err := t.DB.Model(&model.AIConversation{}).Where("uuid = ?", p.Conversation.ID).Updates(model.AIConversation{NextMessageSequence: user.SequenceNumber + 2, UpdatedAt: p.CreatedAt}).Error; err != nil {
		return err
	}
	return t.DB.Create(&model.IdempotencyRecord{UserUUID: p.ActorID, Command: "ai/generate", RequestKey: p.RequestKey, RequestSHA256: p.Digest, Status: "processing", CreatedAt: p.CreatedAt, ExpiresAt: p.CreatedAt.Add(constants.IdempotencyRetention)}).Error
}

func (t *generationTransaction) Complete(uuid string, draft app.Draft, inputTokens, outputTokens uint32) error {
	row, err := t.lock(uuid)
	if err != nil {
		return err
	}
	if row.Status != "pending" {
		return fault.New(fault.Conflict, "生成已结束或超时，请重新发送")
	}
	now, text := time.Now().UTC(), ""
	if draft.Expression.Markdown != nil {
		text = *draft.Expression.Markdown
	}
	output := model.AIMessage{UUID: id.New(), ConversationUUID: row.ConversationUUID, SequenceNumber: row.InputThroughSequence + 1, Speaker: "ai", Body: draft.Reply, CreatedAt: now}
	if err := t.DB.Create(&output).Error; err != nil {
		return err
	}
	for _, review := range draft.Reviews {
		var complies *uint8
		if review.Complies != nil {
			value := uint8(0)
			if *review.Complies {
				value = 1
			}
			complies = &value
		}
		if err := t.DB.Model(&model.GenerationSource{}).Where("generation_uuid = ? AND source_node_uuid = ?", uuid, review.SourceID).Select("Complies", "ExceptionReason").Updates(model.GenerationSource{Complies: complies, ExceptionReason: review.ExceptionReason}).Error; err != nil {
			return err
		}
	}
	update := model.AIGeneration{Status: "succeeded", OutputMessageUUID: &output.UUID, ExpressionMode: &draft.Expression.Mode, ExpressionMarkdown: &text, CompletedAt: &now, InputTokens: &inputTokens, OutputTokens: &outputTokens}
	columns := []string{"Status", "OutputMessageUUID", "ExpressionMode", "ExpressionMarkdown", "CompletedAt", "InputTokens", "OutputTokens"}
	if row.Mode == "action" {
		update.GeneratedTitle, update.ObjectiveMarkdown = &draft.Title, &draft.Objective
		columns = append(columns, "GeneratedTitle", "ObjectiveMarkdown")
	}
	if err := t.DB.Model(&model.AIGeneration{}).Where("uuid = ?", uuid).Select(columns).Updates(update).Error; err != nil {
		return err
	}
	view, err := t.Get(uuid)
	if err != nil {
		return err
	}
	encoded, err := json.Marshal(view)
	if err != nil {
		return err
	}
	status := uint16(200)
	return t.DB.Model(&model.IdempotencyRecord{}).Where("user_uuid = ? AND command = ? AND request_key = ?", t.Actor.UserID, "ai/generate", row.RequestKey).Select("Status", "ResponseHTTPStatus", "ResponseJSON").Updates(model.IdempotencyRecord{Status: "succeeded", ResponseHTTPStatus: &status, ResponseJSON: encoded}).Error
}

func (t *generationTransaction) Fail(uuid, code string) error {
	row, err := t.lock(uuid)
	if err != nil {
		return err
	}
	if row.Status != "pending" {
		return nil
	}
	return t.failRow(uuid, code)
}

func (t *generationTransaction) failRow(uuid, code string) error {
	now := time.Now().UTC()
	return t.DB.Model(&model.AIGeneration{}).Where("uuid = ? AND status = ?", uuid, "pending").Select("Status", "ErrorCode", "CompletedAt").Updates(model.AIGeneration{Status: "failed", ErrorCode: &code, CompletedAt: &now}).Error
}
