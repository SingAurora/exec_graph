package profile

import (
	"context"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// UpdateProfileInput 不包含邮箱、测试标记或可由客户端指定的用户身份。
type UpdateProfileInput struct {
	ExpectedVersion   uint32  `json:"expectedVersion"`
	Name              string  `json:"name"`
	Gender            string  `json:"gender"`
	Bio               string  `json:"bio"`
	AvatarAssetID     *string `json:"avatarAssetId"`
	BackgroundAssetID *string `json:"backgroundAssetId"`
}

// SetHighlightsInput 的数组顺序就是主页展示顺序，允许清空。
type SetHighlightsInput struct {
	ExpectedVersion   uint32   `json:"expectedVersion"`
	ExpressionNodeIDs []string `json:"expressionNodeIds"`
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
