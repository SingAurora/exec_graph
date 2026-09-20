package publicprofile

import "time"

// User 是公开主页允许展示的用户资料，不包含邮箱和内部数据库 ID。
type User struct {
	Username              string `json:"username"`
	UserID                string `json:"userId"`
	Bio                   string `json:"bio"`
	Gender                string `json:"gender"`
	AvatarObjectKey       string `json:"-"`
	ProfileBackgroundKey  string `json:"-"`
	AvatarURL             string `json:"avatarUrl,omitempty"`
	ProfileBackgroundURL  string `json:"profileBackgroundUrl,omitempty"`
	CustomProfileEnabled  bool   `json:"customProfileEnabled"`
	CustomProfileMarkdown string `json:"customProfileMarkdown,omitempty"`
}

// Project 是公开个人主页展示的项目摘要。
type Project struct {
	UUID            string `json:"uuid"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	NodeCount       int    `json:"nodeCount"`
	CompletionCount int    `json:"completionCount"`
}

// Completion 是公开个人主页展示的已验收成果。
type Completion struct {
	UUID                 string    `json:"uuid"`
	ProjectUUID          string    `json:"projectUuid"`
	ProjectTitle         string    `json:"projectTitle"`
	Title                string    `json:"title"`
	Summary              string    `json:"summary"`
	CoveredContractCount int       `json:"coveredContractCount"`
	AIReviewVerdict      string    `json:"aiReviewVerdict"`
	CreatedAt            time.Time `json:"createdAt"`
}

// Profile 聚合用户资料、公开项目与本人形成的公开成果。
type Profile struct {
	User       User         `json:"user"`
	Projects   []Project    `json:"projects"`
	Records    []Completion `json:"records"`
	ActiveDays int          `json:"activeDays"`
}
