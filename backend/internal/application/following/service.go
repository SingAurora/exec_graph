// Package following 实现显式关注状态，不使用含糊的 toggle 操作。
package following

import (
	"context"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 保存关注仓储端口。
type Service struct{ store Store }

// New 创建关注用例。
func New(store Store) *Service { return &Service{store: store} }

// Set 关注只接受可见用户或已有行动的图；取消允许清理已不可见对象。
func (s *Service) Set(ctx context.Context, actor identity.Actor, input SetFollowingInput) (catalogue.FollowingView, error) {
	var out catalogue.FollowingView
	if (input.Kind != "user" && input.Kind != "graph") || !id.Valid(input.TargetID) || input.Following == nil {
		return out, fault.New(fault.Invalid, "关注参数不合法")
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		if *input.Following {
			available, err := tx.Available(input.Kind, input.TargetID)
			if err != nil {
				return err
			}
			if !available || (input.Kind == "user" && input.TargetID == actor.UserID) {
				return fault.New(fault.Conflict, "对象已不可关注")
			}
		}
		if err := tx.Set(input); err != nil {
			return err
		}
		var err error
		out, err = tx.View()
		return err
	})
	return out, err
}
