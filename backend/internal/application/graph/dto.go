// Package graph 实现图资料、创建及受保护的删除用例。
package graph

import (
	"context"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/submission"
)

// CreateGraphInput 创建空图，首次行动单独发布。
type CreateGraphInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// UpdateGraphInput 只使用已上传的资产 UUID，不接受 data URL 或第三方地址。
type UpdateGraphInput struct {
	GraphID           string  `json:"graphId"`
	ExpectedVersion   uint32  `json:"expectedVersion"`
	Title             string  `json:"title"`
	Description       string  `json:"description"`
	AvatarAssetID     *string `json:"avatarAssetId"`
	BackgroundAssetID *string `json:"backgroundAssetId"`
	ContextGuide      *string `json:"contextGuide,omitempty"`
}

// DeleteGraphInput 同时确认图资料版本及用户已看到的行动数量。
type DeleteGraphInput struct {
	GraphID           string  `json:"graphId"`
	ExpectedVersion   uint32  `json:"expectedVersion"`
	ExpectedNodeCount *uint32 `json:"expectedNodeCount"`
}

// Snapshot 是持有图锁后读取的权限及删除判断事实。
type Snapshot struct {
	View              catalogue.GraphView
	TopContributorIDs []string
	NodeCount         uint32
	AvatarAssetID     *string
	BackgroundAssetID *string
}

// Transaction 的所有方法使用同一数据库事务。
type Transaction interface {
	submission.Log
	Lock(string) (Snapshot, error)
	Create(catalogue.GraphView) error
	Update(UpdateGraphInput) error
	Delete(string) error
	CheckAssets(...*string) error
	View(string) (catalogue.GraphView, error)
}

// Store 负责锁定认证账号并向用例注入事务仓储。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}
