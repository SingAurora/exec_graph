// Package draft 实现云端工作区草稿。
package draft

import (
	"context"
	"encoding/json"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// Scope 唯一标识一个工作区草稿。
type Scope struct {
	Type       string  `json:"type"`
	GraphUUID  string  `json:"graphUuid"`
	NodeUUID   *string `json:"nodeUuid,omitempty"`
	ParentUUID *string `json:"parentUuid,omitempty"`
}

// DraftView 是云端草稿。
type DraftView struct {
	UUID           string          `json:"uuid"`
	Version        uint32          `json:"version"`
	Payload        json.RawMessage `json:"payload"`
	LastAccessedAt time.Time       `json:"lastAccessedAt"`
}

// SaveInput 保存草稿；ExpectedVersion 为 0 表示新建。
type SaveInput struct {
	Scope           Scope           `json:"scope"`
	Payload         json.RawMessage `json:"payload"`
	AssetUUIDs      []string        `json:"assetUuids,omitempty"`
	ExpectedVersion uint32          `json:"expectedVersion"`
}

// DeleteInput 删除一个草稿。
type DeleteInput struct {
	Scope Scope `json:"scope"`
}

// Repository 隔离草稿持久化和图片绑定。
type Repository interface {
	Get(context.Context, identity.Actor, Scope) (*DraftView, error)
	Save(context.Context, identity.Actor, Scope, json.RawMessage, []string, uint32) (DraftView, error)
	Delete(context.Context, identity.Actor, Scope) error
	Prune(context.Context, time.Time, int) (int, error)
}
