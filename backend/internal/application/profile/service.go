// Package profile 实现公开资料与集中管理的主页精选。
package profile

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 保存资料用例端口。
type Service struct{ store Store }

// New 创建资料用例。
func New(store Store) *Service { return &Service{store: store} }

func checkVersion(tx Transaction, expected uint32) error {
	version, err := tx.Version()
	if err != nil {
		return err
	}
	if version != expected {
		return fault.New(fault.Conflict, "资料或精选已变化，请刷新后重试")
	}
	return nil
}

// Update 仅修改当前账户的公开资料，精选保持原样。
func (s *Service) Update(ctx context.Context, actor identity.Actor, input UpdateProfileInput) (identity.AccountView, error) {
	var out identity.AccountView
	if input.ExpectedVersion == 0 || strings.TrimSpace(input.Name) == "" || utf8.RuneCountInString(input.Name) > constants.ProfileNameLimit || utf8.RuneCountInString(input.Bio) > constants.BiographyLimit || (input.Gender != "unknown" && input.Gender != "male" && input.Gender != "female") {
		return out, fault.New(fault.Invalid, "昵称、性别或简介格式不合法")
	}
	input.Name = strings.TrimSpace(input.Name)
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		if err := checkVersion(tx, input.ExpectedVersion); err != nil {
			return err
		}
		if err := tx.CheckAssets(input.AvatarAssetID, input.BackgroundAssetID); err != nil {
			return err
		}
		if err := tx.Update(input); err != nil {
			return err
		}
		var err error
		out, err = tx.Account()
		return err
	})
	return out, err
}

// SetHighlights 只精选本人分支的本人非空表达，保留具体分支身份和顺序。
func (s *Service) SetHighlights(ctx context.Context, actor identity.Actor, input SetHighlightsInput) (identity.AccountView, error) {
	var out identity.AccountView
	if input.ExpectedVersion == 0 || input.ExpressionNodeIDs == nil || len(input.ExpressionNodeIDs) > constants.HighlightLimit {
		return out, fault.New(fault.Invalid, "请提交最多五个精选表达，空数组表示清空")
	}
	seen := map[string]bool{}
	for _, uuid := range input.ExpressionNodeIDs {
		if !id.Valid(uuid) || seen[uuid] {
			return out, fault.New(fault.Invalid, "精选表达标识不合法或重复")
		}
		seen[uuid] = true
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		if err := checkVersion(tx, input.ExpectedVersion); err != nil {
			return err
		}
		candidates, err := tx.Candidates(input.ExpressionNodeIDs)
		if err != nil {
			return err
		}
		if len(candidates) != len(input.ExpressionNodeIDs) {
			return fault.New(fault.Invalid, "所选表达已不可用")
		}
		for _, c := range candidates {
			if (c.BranchAuthorID != actor.UserID && c.LocalExpressionActorID != actor.UserID) || c.EffectiveExpressionActorID != actor.UserID || strings.TrimSpace(c.Markdown) == "" {
				return fault.New(fault.Forbidden, "只能精选本人分支上的非空本人表达")
			}
		}
		if err := tx.SetHighlights(input); err != nil {
			return err
		}
		out, err = tx.Account()
		return err
	})
	return out, err
}
