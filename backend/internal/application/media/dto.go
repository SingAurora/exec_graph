// Package media 实现图片上传、草稿保留和未引用资产回收。
package media

import (
	"context"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// AssetView 返回稳定资产身份和站内展示地址，不公开对象键。
type AssetView struct {
	AssetID     string    `json:"assetId"`
	URL         string    `json:"url"`
	MIMEType    string    `json:"mimeType"`
	ByteSize    uint64    `json:"byteSize"`
	Width       uint32    `json:"width"`
	Height      uint32    `json:"height"`
	RetainUntil time.Time `json:"retainUntil"`
}

// Upload 是服务端识别并准备登记的图片元信息。
type Upload struct {
	AssetView
	ObjectKey string
	SHA256    []byte
}

// RetainInput 对草稿使用的本站资产显式续期，空数组不续期任何文件。
type RetainInput struct {
	AssetIDs []string `json:"assetIds"`
}

// RetentionView 告知客户端本次续期截止时间。
type RetentionView struct {
	AssetIDs    []string  `json:"assetIds"`
	RetainUntil time.Time `json:"retainUntil"`
}

// File 描述文件读取权限和实际对象位置。
type File struct {
	ObjectKey string
	MIMEType  string
	OwnerID   string
	Public    bool
}

// CleanupTarget 是被清理任务持久化认领的对象。
type CleanupTarget struct {
	AssetID   string
	ObjectKey string
}

// CleanupReport 记录本轮扫描、删除与失败数量。
type CleanupReport struct {
	Scanned int `json:"scanned"`
	Deleted int `json:"deleted"`
	Failed  int `json:"failed"`
}

// Store 隔离数据库事务、引用检查和删除认领。
type Store interface {
	// Reserve 在同一账号事务中读取用量、执行领域限额规则并登记资产。
	Reserve(context.Context, identity.Actor, Upload, Limits) error
	Complete(context.Context, identity.Actor, string) error
	Retain(context.Context, identity.Actor, []string, time.Time) error
	File(context.Context, string) (File, error)
	Candidates(context.Context, time.Time) ([]string, error)
	Claim(context.Context, string, time.Time) (*CleanupTarget, error)
	FinishDelete(context.Context, string, time.Time) error
}

// Objects 是 bootstrap 注入的外部对象存储能力；Key 仅接受已校验 UUID 和图片格式。
type Objects interface {
	Key(string, string) (string, error)
	Put(context.Context, string, string, []byte) error
	Read(context.Context, string) ([]byte, error)
	Delete(context.Context, string) error
}
