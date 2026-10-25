// Package profile 实现资料和精选的 GORM 仓储。
package profile

import (
	"context"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	app "github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	account "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"gorm.io/gorm"
)

// Repository 使用外部注入的数据库。
type Repository struct{ db *gorm.DB }

// New 创建资料仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

type profileTransaction struct{ *transaction.Scope }

// Within 锁定账户后运行资料用例。
func (r *Repository) Within(ctx context.Context, actor identity.Actor, run func(app.Transaction) error) error {
	return transaction.Within(ctx, r.db, actor, func(scope *transaction.Scope) error { return run(&profileTransaction{scope}) })
}

func (t *profileTransaction) Version() (uint32, error) {
	var user model.User
	err := t.DB.Where("uuid = ?", t.Actor.UserID).Take(&user).Error
	return user.Version, err
}

func (t *profileTransaction) Update(input app.UpdateProfileInput) error {
	return t.DB.Model(&model.User{}).Where("uuid = ?", t.Actor.UserID).Select("Name", "Gender", "BiographyMarkdown", "AvatarAssetUUID", "CoverAssetUUID", "Version", "UpdatedAt").Updates(model.User{Name: input.Name, Gender: input.Gender, BiographyMarkdown: input.Bio, AvatarAssetUUID: input.AvatarAssetID, CoverAssetUUID: input.BackgroundAssetID, Version: input.ExpectedVersion + 1, UpdatedAt: time.Now().UTC()}).Error
}

func (t *profileTransaction) Candidates(ids []string) ([]app.Candidate, error) {
	result := []app.Candidate{}
	if len(ids) == 0 {
		return result, nil
	}
	var graphs []string
	if err := t.DB.Model(&model.ActionNode{}).Where("uuid IN ?", ids).Distinct().Order("graph_uuid").Pluck("graph_uuid", &graphs).Error; err != nil {
		return nil, err
	}
	for _, graph := range graphs {
		if _, err := t.LockGraph(graph); err != nil {
			return nil, err
		}
	}
	err := t.DB.Table("action_nodes AS n").Select("n.uuid AS node_id, n.author_uuid AS branch_author_id, lv.actor_uuid AS local_expression_actor_id, v.actor_uuid AS effective_expression_actor_id, v.markdown").Joins("JOIN graphs g ON g.uuid = n.graph_uuid AND g.deleted_at IS NULL").Joins("JOIN action_document_states s ON s.node_uuid = n.uuid AND s.kind = 'expression'").Joins("JOIN action_document_versions v ON v.uuid = s.effective_version_uuid AND v.mode = 'update'").Joins("LEFT JOIN action_document_versions lv ON lv.uuid = s.local_version_uuid").Where("n.uuid IN ?", ids).Scan(&result).Error
	return result, err
}

func (t *profileTransaction) SetHighlights(input app.SetHighlightsInput) error {
	if err := t.DB.Where("user_uuid = ?", t.Actor.UserID).Delete(&model.ProfileHighlight{}).Error; err != nil {
		return err
	}
	for i, uuid := range input.ExpressionNodeIDs {
		if err := t.DB.Create(&model.ProfileHighlight{UserUUID: t.Actor.UserID, NodeUUID: uuid, Position: uint8(i + 1)}).Error; err != nil {
			return err
		}
	}
	return t.DB.Model(&model.User{}).Where("uuid = ?", t.Actor.UserID).Updates(model.User{Version: input.ExpectedVersion + 1, UpdatedAt: time.Now().UTC()}).Error
}

func (t *profileTransaction) Account() (identity.AccountView, error) {
	value, err := account.New(t.DB, catalogue.New(t.DB)).ByUUID(t.DB.Statement.Context, t.Actor.UserID)
	return value.View, err
}
