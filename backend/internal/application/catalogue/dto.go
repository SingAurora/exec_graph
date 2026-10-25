// Package catalogue 提供当前前端的过渡目录和完整行动上下文读取。
package catalogue

import "time"

// Highlights 只保存按用户顺序选择的表达节点。
type Highlights struct {
	ExpressionNodeIDs []string `json:"expressionNodeIds"`
}

// ProfileView 是不含邮箱和测试管理标记的公开资料。
type ProfileView struct {
	ID              string     `json:"id"`
	Name            string     `json:"name"`
	Gender          string     `json:"gender"`
	Bio             string     `json:"bio"`
	Avatar          string     `json:"avatar"`
	BackgroundImage *string    `json:"backgroundImage,omitempty"`
	ActiveDays      int        `json:"activeDays"`
	Highlights      Highlights `json:"highlights"`
}

// GraphView 保留当前 UI 的 Project 字段语义。
type GraphView struct {
	ID              string    `json:"id"`
	OwnerID         string    `json:"ownerId"`
	ParticipantIDs  []string  `json:"participantIds"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Avatar          *string   `json:"avatar,omitempty"`
	BackgroundImage *string   `json:"backgroundImage,omitempty"`
	ContextGuide    string    `json:"contextGuide,omitempty"`
	Version         uint32    `json:"version"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// Image 是附图展示结构。
type Image struct {
	URL string `json:"url"`
	Alt string `json:"alt"`
}

// Message 是已确认形成过程中的一条消息。
type Message struct {
	ID       string `json:"id"`
	Speaker  string `json:"speaker"`
	Body     string `json:"body"`
	AuthorID string `json:"authorId,omitempty"`
}

// Revision 只描述发布后的明确文档操作，不代表协作权限。
type Revision struct {
	AuthorID  string    `json:"authorId"`
	CreatedAt time.Time `json:"createdAt"`
	Kind      string    `json:"kind"`
}

// Assessment 区分未知、满足和不满足；未知不得转换成满足。
type Assessment struct {
	SourceID        string  `json:"sourceId"`
	Complies        *bool   `json:"complies"`
	ExceptionReason *string `json:"exceptionReason,omitempty"`
}

// ContextSnapshot 描述本行动的真实引用背景。
type ContextSnapshot struct {
	DirectNodeIDs    []string `json:"directNodeIds"`
	HistoryNodeCount uint32   `json:"historyNodeCount"`
	Guide            string   `json:"guide,omitempty"`
}

// ActionView 与前端 ActionContextNode 对应，nil 文档表示继承，空字符串表示清空。
type ActionView struct {
	ID                     string           `json:"id"`
	GraphID                string           `json:"graphId"`
	Number                 uint32           `json:"number"`
	ParentID               string           `json:"parentId,omitempty"`
	MergedParentIDs        []string         `json:"mergedParentIds,omitempty"`
	AuthorID               string           `json:"authorId"`
	Title                  string           `json:"title"`
	Markdown               string           `json:"markdown"`
	ObjectiveMarkdown      string           `json:"objectiveMarkdown"`
	ExpressionMarkdown     *string          `json:"expressionMarkdown,omitempty"`
	AgreementMarkdown      *string          `json:"agreementMarkdown,omitempty"`
	ExpressionSupplement   *Revision        `json:"expressionSupplement,omitempty"`
	AgreementSupplement    *Revision        `json:"agreementSupplement,omitempty"`
	ReferenceAgreements    []Assessment     `json:"referenceAgreements"`
	ContextSnapshot        *ContextSnapshot `json:"contextSnapshot,omitempty"`
	Images                 []Image          `json:"images"`
	Conversation           []Message        `json:"conversation"`
	ExpressionConversation []Message        `json:"expressionConversation,omitempty"`
	Version                uint32           `json:"version"`
	CreatedAt              time.Time        `json:"createdAt"`
}

// FollowingView 是当前账户的显式关注集合。
type FollowingView struct {
	UserIDs  []string `json:"userIds"`
	GraphIDs []string `json:"graphIds"`
}

// MediaMetadata 是读取站内文件所需的最小信息。
type MediaMetadata struct {
	ObjectKey string
	MIMEType  string
}
