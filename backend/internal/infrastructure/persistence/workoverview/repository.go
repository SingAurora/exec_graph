// Package workoverview contains GORM persistence for calendar activities and daily reviews.
package workoverview

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// ActivityProjection is the persistence projection used by the work overview.
type ActivityProjection struct {
	ID           string     `gorm:"column:id"`
	ProjectID    string     `gorm:"column:project_id"`
	ProjectTitle string     `gorm:"column:project_title"`
	NodeID       string     `gorm:"column:node_id"`
	Title        string     `gorm:"column:title"`
	Detail       string     `gorm:"column:detail"`
	RecordKind   string     `gorm:"column:record_kind"`
	CreatedAt    time.Time  `gorm:"column:created_at"`
	StartedAt    *time.Time `gorm:"column:started_at"`
	EndedAt      *time.Time `gorm:"column:ended_at"`
}

// ReviewProjection is the stored daily review projection.
type ReviewProjection struct {
	ID         string    `gorm:"column:uuid"`
	Date       string    `gorm:"column:review_date"`
	ReviewJSON string    `gorm:"column:review_json"`
	AIConfig   string    `gorm:"column:ai_config_json"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

// ReviewContent is the stable JSON shape stored for a daily review.
type ReviewContent struct {
	Summary    string   `json:"summary"`
	Momentum   string   `json:"momentum"`
	Highlights []string `json:"highlights"`
	Friction   []string `json:"friction"`
	NextStep   string   `json:"nextStep"`
}

// Repository owns work-overview persistence and hides GORM from application code.
type Repository struct {
	orm *gorm.DB
}

// NewRepository creates a work-overview repository.
func NewRepository(orm *gorm.DB) *Repository { return &Repository{orm: orm} }

// ListActivities returns node starts and completion records in the requested window.
func (repository *Repository) ListActivities(ctx context.Context, userID uint64, start, end time.Time) ([]ActivityProjection, error) {
	var activities []ActivityProjection
	nodes := repository.orm.WithContext(ctx).Table("execution_contracts AS n").
		Select("n.uuid AS id, p.uuid AS project_id, p.title AS project_title, n.uuid AS node_id, n.title, n.verifiable_goal AS detail, '' AS record_kind, COALESCE(n.started_at, n.created_at) AS created_at, n.started_at, n.ended_at").
		Joins("JOIN projects AS p ON p.id = n.project_id").
		Where("n.actor_id = ? AND p.owner_id = ? AND COALESCE(n.started_at, n.created_at) >= ? AND COALESCE(n.started_at, n.created_at) < ?", userID, userID, start, end).
		Order("COALESCE(n.started_at, n.created_at) ASC").
		Scan(&activities)
	if nodes.Error != nil {
		return nil, nodes.Error
	}

	var records []ActivityProjection
	result := repository.orm.WithContext(ctx).Table("completion_records AS r").
		Select("r.uuid AS id, p.uuid AS project_id, p.title AS project_title, n.uuid AS node_id, r.title, r.summary AS detail, r.record_kind, r.created_at").
		Joins("JOIN projects AS p ON p.id = r.project_id").
		Joins("JOIN execution_contracts AS n ON n.id = r.closing_contract_id").
		Where("p.owner_id = ? AND r.created_at >= ? AND r.created_at < ?", userID, start, end).
		Order("r.created_at ASC").
		Scan(&records)
	if result.Error != nil {
		return nil, result.Error
	}
	return append(activities, records...), nil
}

// ListReviews returns daily reviews in the requested date window.
func (repository *Repository) ListReviews(ctx context.Context, userID uint64, start, end time.Time) ([]ReviewProjection, error) {
	var reviews []ReviewProjection
	result := repository.orm.WithContext(ctx).Table("daily_work_reviews").
		Select("uuid, DATE_FORMAT(review_date, '%Y-%m-%d') AS review_date, review_json, ai_config_json, created_at, updated_at").
		Where("user_id = ? AND review_date >= ? AND review_date < ?", userID, start, end).
		Order("review_date ASC").
		Scan(&reviews)
	return reviews, result.Error
}

// SaveReview creates or updates one user's review for a calendar day.
func (repository *Repository) SaveReview(ctx context.Context, userID uint64, date time.Time, content ReviewContent, aiConfig string, reviewID string) error {
	payload, err := json.Marshal(content)
	if err != nil {
		return err
	}
	return repository.orm.WithContext(ctx).Exec(`
		INSERT INTO daily_work_reviews (uuid, user_id, review_date, review_json, ai_config_json)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE review_json = VALUES(review_json), ai_config_json = VALUES(ai_config_json)`,
		reviewID, userID, date.Format("2006-01-02"), payload, aiConfig).Error
}
