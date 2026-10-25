// Package demoseed 校验并转换显式导入的演示数据。
package demoseed

import (
	"context"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
)

// User 是演示源用户，邮箱只用于建立测试凭据。
type User struct {
	catalogue.ProfileView
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
}

// Asset 是被导出脚本收集的本地配图。
type Asset struct {
	Key string `json:"key"`
}

// Dataset 是当前前端演示数据的稳定导出格式。
type Dataset struct {
	Dataset   string                  `json:"dataset"`
	Users     []User                  `json:"users"`
	Graphs    []catalogue.GraphView   `json:"graphs"`
	Actions   []catalogue.ActionView  `json:"actions"`
	Following catalogue.FollowingView `json:"following"`
	Assets    []Asset                 `json:"assets"`
}

// Alias 是旧演示短 ID 到 UUID 的显式映射。
type Alias struct {
	Kind  string
	Alias string
	UUID  string
}

// Document 是本节点明确写入或清空的初始版本。
type Document struct {
	UUID         string
	Kind         string
	Mode         string
	Markdown     string
	PreviousUUID *string
}

// Node 是已完成归属、背景与继承校验的导入节点。
type Node struct {
	View                    catalogue.ActionView
	Level                   uint32
	Documents               []Document
	ExpressionMode          string
	AgreementMode           string
	LocalExpressionUUID     *string
	EffectiveExpressionUUID *string
	LocalAgreementUUID      *string
	EffectiveAgreementUUID  *string
}

// Reference 是来源核验后固定的真实引用。
type Reference struct {
	UUID          string
	GraphUUID     string
	SourceUUID    string
	TargetUUID    string
	Kind          string
	AgreementUUID *string
	Status        string
	Reason        *string
}

// Prepared 是可一次性原子导入的明确记录，不能由公开请求提交。
type Prepared struct {
	Dataset    string
	Digest     string
	Users      []User
	Graphs     []catalogue.GraphView
	Nodes      []Node
	References []Reference
	Aliases    []Alias
	Following  catalogue.FollowingView
	Assets     []Asset
}

// Passwords 抽象随机密码及哈希，不在业务 DTO 中存储明文。
type Passwords interface {
	Hash(string) (string, error)
	Token() string
}

// Repository 原子写入已校验数据，相同批次重跑不得覆盖业务。
type Repository interface {
	Import(context.Context, Prepared) (bool, error)
}
