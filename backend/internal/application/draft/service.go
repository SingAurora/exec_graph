package draft

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

const maxDraftPayloadBytes = 512 * 1024

// Service 负责草稿作用域和输入校验。
type Service struct{ repository Repository }

// New 创建草稿服务。
func New(repository Repository) *Service { return &Service{repository: repository} }

// Get 读取草稿并续期最后访问时间。
func (s *Service) Get(ctx context.Context, actor identity.Actor, scope Scope) (*DraftView, error) {
	if err := validateScope(scope); err != nil { return nil, err }
	return s.repository.Get(ctx, actor, scope)
}

// Save 新建或按版本更新草稿。
func (s *Service) Save(ctx context.Context, actor identity.Actor, input SaveInput) (DraftView, error) {
	if err := validateScope(input.Scope); err != nil { return DraftView{}, err }
	if len(input.Payload) == 0 || len(input.Payload) > maxDraftPayloadBytes { return DraftView{}, fault.New(fault.Invalid, "草稿内容为空或过大") }
	if !json.Valid(input.Payload) { return DraftView{}, fault.New(fault.Invalid, "草稿内容格式不合法") }
	return s.repository.Save(ctx, actor, input.Scope, input.Payload, input.AssetUUIDs, input.ExpectedVersion)
}

// Delete 删除草稿并标记其图片待回收。
func (s *Service) Delete(ctx context.Context, actor identity.Actor, input DeleteInput) error {
	if err := validateScope(input.Scope); err != nil { return err }
	return s.repository.Delete(ctx, actor, input.Scope)
}

func validateScope(scope Scope) error {
	if scope.Type != "action" && scope.Type != "expression" && scope.Type != "agreement" { return fault.New(fault.Invalid, "草稿类型不合法") }
	if !id.Valid(scope.GraphUUID) { return fault.New(fault.Invalid, "图标识不合法") }
	if scope.NodeUUID != nil && (strings.TrimSpace(*scope.NodeUUID) == "" || !id.Valid(*scope.NodeUUID)) { return fault.New(fault.Invalid, "节点标识不合法") }
	if scope.ParentUUID != nil && (strings.TrimSpace(*scope.ParentUUID) == "" || !id.Valid(*scope.ParentUUID)) { return fault.New(fault.Invalid, "父节点标识不合法") }
	return nil
}

// ScopeKey 生成账号内的草稿唯一键。
func ScopeKey(scope Scope) string {
	node, parent := "", ""
	if scope.NodeUUID != nil { node = *scope.NodeUUID }
	if scope.ParentUUID != nil { parent = *scope.ParentUUID }
	return scope.Type + ":" + scope.GraphUUID + ":" + node + ":" + parent
}
