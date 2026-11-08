// Package catalogue 提供当前前端的过渡目录和完整行动上下文读取。
package catalogue

import "time"

// LocationView 是公开显示的中国大陆省、市、区县地址。
type LocationView struct {
	Code         string `json:"code"`
	ProvinceCode string `json:"provinceCode"`
	Province     string `json:"province"`
	CityCode     string `json:"cityCode"`
	City         string `json:"city"`
	DistrictCode string `json:"districtCode"`
	District     string `json:"district"`
}

// Highlights 只保存按用户顺序选择的表达节点。
type Highlights struct {
	ExpressionNodeIDs []string `json:"expressionNodeUuids"`
}

// ProfileView 是不含邮箱和测试管理标记的公开资料。
type ProfileView struct {
	LegacyID          string        `json:"legacyId,omitempty"`
	ID                string        `json:"uuid"`
	Name              string        `json:"name"`
	Gender            string        `json:"gender"`
	Bio               string        `json:"bio"`
	Location          *LocationView `json:"location,omitempty"`
	Avatar            string        `json:"avatar"`
	BackgroundImage   *string       `json:"backgroundImage,omitempty"`
	AvatarAssetID     *string       `json:"avatarAssetUuid"`
	BackgroundAssetID *string       `json:"backgroundAssetUuid"`
	ActiveDays        int           `json:"activeDays"`
	Highlights        Highlights    `json:"highlights"`
}

// GraphView 对应前端的行动图模型。
type GraphView struct {
	LegacyID          string    `json:"legacyId,omitempty"`
	ID                string    `json:"uuid"`
	OwnerID           string    `json:"ownerUuid"`
	ParticipantIDs    []string  `json:"participantUuids"`
	Title             string    `json:"title"`
	Description       string    `json:"description"`
	Avatar            *string   `json:"avatar,omitempty"`
	BackgroundImage   *string   `json:"backgroundImage,omitempty"`
	AvatarAssetID     *string   `json:"avatarAssetUuid"`
	BackgroundAssetID *string   `json:"backgroundAssetUuid"`
	ContextGuide      string    `json:"contextGuide,omitempty"`
	Version           uint32    `json:"version"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// Image 是附图展示结构。
type Image struct {
	AssetID *string `json:"assetUuid,omitempty"`
	URL     string  `json:"url"`
	Alt     string  `json:"alt"`
}

// Message 是已确认形成过程中的一条消息；AI 消息带实际生成模型名。
type Message struct {
	ID       string `json:"id"`
	Speaker  string `json:"speaker"`
	Body     string `json:"body"`
	AuthorID string `json:"authorUuid,omitempty"`
	Model    string `json:"model,omitempty"`
}

// Revision 只描述发布后的明确文档操作，不代表协作权限。
type Revision struct {
	AuthorID  string    `json:"authorUuid"`
	CreatedAt time.Time `json:"createdAt"`
	Kind      string    `json:"kind"`
}

// Assessment 区分未知、满足和不满足；未知不得转换成满足。
type Assessment struct {
	SourceID        string  `json:"sourceUuid"`
	Complies        *bool   `json:"complies"`
	ExceptionReason *string `json:"exceptionReason,omitempty"`
}

// ContextSnapshot 描述本行动的真实引用背景。
type ContextSnapshot struct {
	DirectNodeIDs    []string `json:"directNodeUuids"`
	HistoryNodeCount uint32   `json:"historyNodeCount"`
	Guide            string   `json:"guide,omitempty"`
}

// ActionView 与前端 ActionContextNode 对应，nil 文档表示继承，空字符串表示清空。
type ActionView struct {
	LegacyID               string           `json:"legacyId,omitempty"`
	ID                     string           `json:"uuid"`
	GraphID                string           `json:"graphUuid"`
	Number                 uint32           `json:"number"`
	ParentID               string           `json:"parentUuid,omitempty"`
	MergedParentIDs        []string         `json:"mergedParentUuids,omitempty"`
	AuthorID               string           `json:"authorUuid"`
	Title                  string           `json:"title"`
	Markdown               string           `json:"markdown"`
	ObjectiveMarkdown      string           `json:"objectiveMarkdown"`
	ExpressionMarkdown     *string          `json:"expressionMarkdown,omitempty"`
	AgreementMarkdown      *string          `json:"agreementMarkdown,omitempty"`
	ExpressionStatus       string           `json:"expressionStatus,omitempty"`
	AgreementStatus        string           `json:"agreementStatus,omitempty"`
	NodeReady              bool             `json:"nodeReady"`
	ExpressionSupplement   *Revision        `json:"expressionSupplement,omitempty"`
	AgreementSupplement    *Revision        `json:"agreementSupplement,omitempty"`
	ReferenceAgreements    []Assessment     `json:"referenceAgreements"`
	ContextSnapshot        *ContextSnapshot `json:"contextSnapshot,omitempty"`
	Images                 []Image          `json:"images"`
	Conversation           []Message        `json:"conversation"`
	ExpressionConversation []Message        `json:"expressionConversation,omitempty"`
	AgreementConversation  []Message        `json:"agreementConversation,omitempty"`
	Version                uint32           `json:"version"`
	CreatedAt              time.Time        `json:"createdAt"`
}

// FollowingView 是当前账户的显式关注集合。
type FollowingView struct {
	UserIDs  []string `json:"userUuids"`
	GraphIDs []string `json:"graphUuids"`
}
