package following

import (
	"context"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// SetFollowingInput 必须显式提供 following，遗漏不能当作取消。
type SetFollowingInput struct {
	Kind      string `json:"kind"`
	TargetID  string `json:"targetId"`
	Following *bool  `json:"following"`
}

// Transaction 提供同一事务内的目标检查和关注更新。
type Transaction interface {
	Available(kind, target string) (bool, error)
	Set(SetFollowingInput) error
	View() (catalogue.FollowingView, error)
}

// Store 隔离 GORM 事务。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}
