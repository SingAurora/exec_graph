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
