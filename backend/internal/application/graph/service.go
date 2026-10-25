package graph

import (
	"context"
	"slices"
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

// Service 依赖事务端口，不持有 GORM 或 HTTP 对象。
type Service struct{ store Store }

// New 注入图事务仓储。
func New(store Store) *Service { return &Service{store: store} }

func validText(title, description string) bool {
	return strings.TrimSpace(title) != "" && utf8.RuneCountInString(title) <= constants.GraphTitleLimit && utf8.RuneCountInString(description) <= constants.GraphDescriptionLimit
}

// Create 创建空图，成功响应快照与图记录在同一事务中提交。
func (s *Service) Create(ctx context.Context, actor identity.Actor, key string, input CreateGraphInput) (catalogue.GraphView, error) {
	var out catalogue.GraphView
	if !validText(input.Title, input.Description) {
		return out, fault.New(fault.Invalid, "图名称或简介长度不合法")
	}
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		var err error
		out, err = submission.Run(tx, "graphs/create", key, input, func() (catalogue.GraphView, error) {
			now := time.Now().UTC()
			view := catalogue.GraphView{ID: id.New(), OwnerID: actor.UserID, ParticipantIDs: []string{}, Title: input.Title, Description: input.Description, Version: 1, CreatedAt: now, UpdatedAt: now}
			return view, tx.Create(view)
		})
		return err
	})
	return out, err
}

// Update 允许创建者或贡献行动数量前三位的用户修改图资料。
func (s *Service) Update(ctx context.Context, actor identity.Actor, input UpdateGraphInput) (catalogue.GraphView, error) {
	var out catalogue.GraphView
	if !id.Valid(input.GraphID) || input.ExpectedVersion == 0 || !validText(input.Title, input.Description) || (input.ContextGuide != nil && utf8.RuneCountInString(*input.ContextGuide) > constants.ContextGuideLimit) {
		return out, fault.New(fault.Invalid, "图资料或版本不合法")
	}
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		current, err := tx.Lock(input.GraphID)
		if err != nil {
			return err
		}
		if current.View.OwnerID != actor.UserID && !slices.Contains(current.TopContributorIDs, actor.UserID) {
			return fault.New(fault.Forbidden, "没有编辑此图的权限")
		}
		if current.View.Version != input.ExpectedVersion {
			return fault.New(fault.Conflict, "图资料已变化，请刷新后重试")
		}
		// 保留图的现有图片不视为重新使用他人资产；新换入的图片仍需属于当前编辑者。
		if !sameAsset(input.AvatarAssetID, current.AvatarAssetID) {
			if err := tx.CheckAssets(input.AvatarAssetID); err != nil {
				return err
			}
		}
		if !sameAsset(input.BackgroundAssetID, current.BackgroundAssetID) {
			if err := tx.CheckAssets(input.BackgroundAssetID); err != nil {
				return err
			}
		}
		if err := tx.Update(input); err != nil {
			return err
		}
		out, err = tx.View(input.GraphID)
		return err
	})
	return out, err
}

func sameAsset(left, right *string) bool {
	return (left == nil && right == nil) || (left != nil && right != nil && *left == *right)
}

// Delete 仅删除当前用户独自参与且数量、版本均未变化的图，保留历史记录。
func (s *Service) Delete(ctx context.Context, actor identity.Actor, input DeleteGraphInput) error {
	if !id.Valid(input.GraphID) || input.ExpectedVersion == 0 || input.ExpectedNodeCount == nil {
		return fault.New(fault.Invalid, "删除参数不完整")
	}
	return s.store.Within(ctx, actor, func(tx Transaction) error {
		current, err := tx.Lock(input.GraphID)
		if err != nil {
			return err
		}
		if current.View.OwnerID != actor.UserID {
			return fault.New(fault.Forbidden, "只有独自参与此图的用户可以删除")
		}
		for _, user := range current.View.ParticipantIDs {
			if user != actor.UserID {
				return fault.New(fault.Forbidden, "已有其他用户参与，不能删除此图")
			}
		}
		if current.View.Version != input.ExpectedVersion || current.NodeCount != *input.ExpectedNodeCount {
			return fault.New(fault.Conflict, "图资料或节点数量已变化，请重新确认删除")
		}
		return tx.Delete(input.GraphID)
	})
}
