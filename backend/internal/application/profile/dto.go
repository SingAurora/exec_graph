package profile

import (
	"context"
	"encoding/json"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// NullableLocationCode 区分“明确清空所在地”和“请求没有提交所在地字段”。
type NullableLocationCode struct {
	Value   *string
	Present bool
}

// UnmarshalJSON 允许区县代码或 null，不接受其他 JSON 类型。
func (v *NullableLocationCode) UnmarshalJSON(data []byte) error {
	v.Present = true
	if string(data) == "null" {
		v.Value = nil
		return nil
	}
	var value string
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	v.Value = &value
	return nil
}

// MarshalJSON 让内部测试和 HTTP 客户端把值编码为区县代码或 null，而不是暴露包装结构。
func (v NullableLocationCode) MarshalJSON() ([]byte, error) { return json.Marshal(v.Value) }

// UpdateProfileInput 不包含邮箱、测试标记或可由客户端指定的用户身份。
type UpdateProfileInput struct {
	ExpectedVersion   uint32               `json:"expectedVersion"`
	Name              string               `json:"name"`
	Gender            string               `json:"gender"`
	Bio               string               `json:"bio"`
	LocationCode      NullableLocationCode `json:"locationCode"`
	AvatarAssetID     *string              `json:"avatarAssetUuid"`
	BackgroundAssetID *string              `json:"backgroundAssetUuid"`
}

// SetHighlightsInput 的数组顺序就是主页展示顺序，允许清空。
type SetHighlightsInput struct {
	ExpectedVersion   uint32   `json:"expectedVersion"`
	ExpressionNodeIDs []string `json:"expressionNodeUuids"`
}

// Candidate 是表达归属判断所需的最小事实。
type Candidate struct {
	NodeID                     string
	BranchAuthorID             string
	LocalExpressionActorID     string
	EffectiveExpressionActorID string
	Markdown                   string
}

// Transaction 的资料、精选和账户响应处于同一事务视图。
type Transaction interface {
	Version() (uint32, error)
	CheckAssets(...*string) error
	Update(UpdateProfileInput) error
	Candidates([]string) ([]Candidate, error)
	SetHighlights(SetHighlightsInput) error
	Account() (identity.AccountView, error)
}

// Store 负责锁定当前账号，防止资料和精选互相覆盖。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}
