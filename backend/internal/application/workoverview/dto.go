package workoverview

import "time"

type Activity struct {
	ID           string
	Kind         string
	ProjectID    string
	ProjectTitle string
	NodeID       string
	Title        string
	Detail       string
	CreatedAt    time.Time
	StartedAt    *time.Time
	EndedAt      *time.Time
}

type DailyReview struct {
	ID         string
	Date       string
	Summary    string
	Momentum   string
	Highlights []string
	Friction   []string
	NextStep   string
	AIConfig   string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Day struct {
	Date       string
	Activities []Activity
	Review     *DailyReview
}

type SaveReviewInput struct {
	UserID     uint64
	Date       time.Time
	Summary    string
	Momentum   string
	Highlights []string
	Friction   []string
	NextStep   string
	AIConfig   string
}

// ActionState 是一个时间窗口内已经记录的行动事实，不代表现实结果的裁判。
type ActionState struct {
	Window           string
	Range            ActionStateRange
	Coverage         ActionStateCoverage
	Facts            ActionStateFacts
	Comparison       ActionStateComparison
	RecentActivities []Activity
}

// ActionStateRange 描述行动状态统计的本地时间范围。
type ActionStateRange struct {
	Start    time.Time
	End      time.Time
	Timezone string
	Partial  bool
}

// ActionStateCoverage 描述当前窗口内有多少天留下了可读取记录。
type ActionStateCoverage struct {
	WindowDays   int
	ActiveDays   int
	ReviewedDays int
	Confidence   string
}

// ActionStateFacts 汇总已有节点和阶段记录的数量。
type ActionStateFacts struct {
	Activities       int
	Started          int
	ConfirmedRecords int
	SealedRecords    int
}

// ActionStateComparison 只描述记录量相对上一窗口的变化，不把变化解释成人格或能力结论。
type ActionStateComparison struct {
	PreviousActivities int
	PreviousActiveDays int
	ActivityChange     int
	ActiveDaysChange   int
	Conclusion         string
}
