// Package generation 管理生成的私有输入、来源快照及结果，不在事务内调用 AI。
package generation

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	appaction "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	actions "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/action"
	read "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository 复用图事务锁与账号认证版本。
type Repository struct{ db *gorm.DB }

// New 创建生成仓储。
func New(db *gorm.DB) *Repository { return &Repository{db} }

type generationTransaction struct{ *transaction.Scope }

// Within 进入短数据库事务，外部调用由 application 在事务外执行。
func (r *Repository) Within(ctx context.Context, actor identity.Actor, run func(app.Transaction) error) error {
	return transaction.Within(ctx, r.db, actor, func(scope *transaction.Scope) error { return run(&generationTransaction{scope}) })
}

func (t *generationTransaction) Graph(uuid string) (appaction.Graph, error) {
	return actions.InScope(t.Scope).Graph(uuid)
}
func (t *generationTransaction) Facts(uuid string) ([]catalogue.ActionView, error) {
	return read.New(t.DB).Actions(t.DB.Statement.Context, uuid)
}

func (t *generationTransaction) Existing(key string) (*app.Request, error) {
	var record model.IdempotencyRecord
	err := t.DB.Where("user_uuid = ? AND command = ? AND request_key = ?", t.Actor.UserID, "ai/generate", key).Take(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var view app.View
	if record.Status == "succeeded" {
		if err := json.Unmarshal(record.ResponseJSON, &view); err != nil {
			return nil, err
		}
	} else {
		var row model.AIGeneration
		if err := t.DB.Where("requested_by_uuid = ? AND request_key = ?", t.Actor.UserID, key).Take(&row).Error; err != nil {
			return nil, err
		}
		view, err = t.Get(row.UUID)
		if err != nil {
			return nil, err
		}
	}
	return &app.Request{Digest: record.RequestSHA256, View: view}, nil
}

func (t *generationTransaction) lock(uuid string) (model.AIGeneration, error) {
	var row model.AIGeneration
	err := t.DB.Where("uuid = ? AND requested_by_uuid = ?", uuid, t.Actor.UserID).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return row, fault.New(fault.NotFound, "生成不存在")
	}
	if err != nil {
		return row, err
	}
	if _, err := t.LockGraph(row.GraphUUID); err != nil {
		return row, err
	}
	var conversation model.AIConversation
	if err := t.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", row.ConversationUUID).Take(&conversation).Error; err != nil {
		return row, err
	}
	err = t.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", uuid).Take(&row).Error
	return row, err
}

func (t *generationTransaction) Get(uuid string) (app.View, error) {
	row, err := t.lock(uuid)
	if err != nil {
		return app.View{}, err
	}
	if row.Status == "pending" && time.Since(row.CreatedAt) > constants.AIPendingTimeout {
		if err := t.failRow(row.UUID, "interrupted"); err != nil {
			return app.View{}, err
		}
		row.Status = "failed"
		code := "interrupted"
		row.ErrorCode = &code
	}
	return t.view(row)
}

func (t *generationTransaction) view(row model.AIGeneration) (app.View, error) {
	out := app.View{GenerationID: row.UUID, ConversationID: row.ConversationUUID, Status: row.Status}
	if row.ErrorCode != nil {
		out.ErrorCode = *row.ErrorCode
	}
	if row.Status != "succeeded" {
		return out, nil
	}
	draft := &app.Draft{Reviews: []appaction.SourceAssessment{}}
	if row.ExpressionMode != nil {
		draft.Expression.Mode = *row.ExpressionMode
	}
	if draft.Expression.Mode == "update" {
		draft.Expression.Markdown = row.ExpressionMarkdown
	}
	if row.GeneratedTitle != nil {
		draft.Title = *row.GeneratedTitle
	}
	if row.ObjectiveMarkdown != nil {
		draft.Objective = *row.ObjectiveMarkdown
	}
	var message model.AIMessage
	if err := t.DB.Where("uuid = ?", row.OutputMessageUUID).Take(&message).Error; err != nil {
		return out, err
	}
	draft.Reply = message.Body
	var sources []model.GenerationSource
	if err := t.DB.Where("generation_uuid = ?", row.UUID).Order("CASE WHEN kind = 'primary' THEN 0 ELSE 1 END, id").Find(&sources).Error; err != nil {
		return out, err
	}
	confirmation := &appaction.CreateActionInput{GraphID: row.GraphUUID, GenerationID: row.UUID, MergedParentIDs: []string{}, SourceVersions: []appaction.SourceVersion{}, ReferenceAgreements: []appaction.SourceAssessment{}, Images: []appaction.ImageInput{}}
	for _, source := range sources {
		review := appaction.SourceAssessment{SourceID: source.SourceNodeUUID, ExceptionReason: source.ExceptionReason, Provided: true}
		if source.Complies != nil {
			value := *source.Complies == 1
			review.Complies = &value
		}
		draft.Reviews = append(draft.Reviews, review)
		if source.Kind == "primary" {
			confirmation.ParentID = source.SourceNodeUUID
		} else {
			confirmation.MergedParentIDs = append(confirmation.MergedParentIDs, source.SourceNodeUUID)
		}
		confirmation.SourceVersions = append(confirmation.SourceVersions, appaction.SourceVersion{NodeID: source.SourceNodeUUID, Version: source.SourceNodeVersion})
		confirmation.ReferenceAgreements = append(confirmation.ReferenceAgreements, review)
	}
	out.Draft = draft
	if row.Mode == "action" {
		out.CreateAction = confirmation
	} else {
		var conversation model.AIConversation
		if err := t.DB.Where("uuid = ?", row.ConversationUUID).Take(&conversation).Error; err != nil {
			return out, err
		}
		if conversation.NodeUUID == nil || row.BaseNodeVersion == nil {
			return out, fault.New(fault.Unavailable, "生成节点信息不完整")
		}
		out.UpdateExpression = &appaction.UpdateExpressionInput{NodeID: *conversation.NodeUUID, ExpectedVersion: *row.BaseNodeVersion, GenerationID: row.UUID}
	}
	return out, nil
}
