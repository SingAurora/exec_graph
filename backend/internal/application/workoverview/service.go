// Package workoverview contains daily activity and review use cases.
package workoverview

import (
	"context"
	"encoding/json"
	"time"

	workoverviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/workoverview"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository *workoverviewpersistence.Repository
}

func New(repository *workoverviewpersistence.Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) ListDays(ctx context.Context, userID uint64, start, end time.Time) ([]Day, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.WorkOverviewTimeout)
	defer cancel()
	byDate := map[string]*Day{}
	add := func(activity Activity) {
		date := activity.CreatedAt.In(time.Local).Format("2006-01-02")
		day := byDate[date]
		if day == nil {
			day = &Day{Date: date, Activities: make([]Activity, 0)}
			byDate[date] = day
		}
		day.Activities = append(day.Activities, activity)
	}

	activities, err := s.repository.ListActivities(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	for _, stored := range activities {
		activity := Activity{ID: stored.ID, ProjectID: stored.ProjectID, ProjectTitle: stored.ProjectTitle, NodeID: stored.NodeID, Title: stored.Title, Detail: stored.Detail, CreatedAt: stored.CreatedAt, StartedAt: stored.StartedAt, EndedAt: stored.EndedAt}
		if stored.RecordKind == "" {
			activity.Kind = "started"
			activity.ID = "node:" + activity.ID
		} else {
			activity.Kind = "completed"
			if stored.RecordKind == "sealed" {
				activity.Kind = "sealed"
			}
		}
		add(activity)
	}

	reviews, err := s.listReviews(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	for date, review := range reviews {
		day := byDate[date]
		if day == nil {
			day = &Day{Date: date, Activities: make([]Activity, 0)}
			byDate[date] = day
		}
		day.Review = &review
	}

	result := make([]Day, 0, len(byDate))
	for _, day := range byDate {
		for i := 1; i < len(day.Activities); i++ {
			current := day.Activities[i]
			j := i - 1
			for j >= 0 && current.CreatedAt.Before(day.Activities[j].CreatedAt) {
				day.Activities[j+1] = day.Activities[j]
				j--
			}
			day.Activities[j+1] = current
		}
		result = append(result, *day)
	}
	for i := 1; i < len(result); i++ {
		current := result[i]
		j := i - 1
		for j >= 0 && current.Date < result[j].Date {
			result[j+1] = result[j]
			j--
		}
		result[j+1] = current
	}
	return result, nil
}

func (s *Service) listReviews(ctx context.Context, userID uint64, start, end time.Time) (map[string]DailyReview, error) {
	rows, err := s.repository.ListReviews(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	reviews := map[string]DailyReview{}
	for _, stored := range rows {
		var content struct {
			Summary    string   `json:"summary"`
			Momentum   string   `json:"momentum"`
			Highlights []string `json:"highlights"`
			Friction   []string `json:"friction"`
			NextStep   string   `json:"nextStep"`
		}
		if err := json.Unmarshal([]byte(stored.ReviewJSON), &content); err != nil {
			continue
		}
		reviews[stored.Date] = DailyReview{ID: stored.ID, Date: stored.Date, Summary: content.Summary, Momentum: content.Momentum, Highlights: content.Highlights, Friction: content.Friction, NextStep: content.NextStep, AIConfig: stored.AIConfig, CreatedAt: stored.CreatedAt, UpdatedAt: stored.UpdatedAt}
	}
	return reviews, nil
}

func (s *Service) SaveReview(ctx context.Context, input SaveReviewInput) (DailyReview, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DailyWorkReviewTimeout)
	defer cancel()
	reviewID, err := sharedid.Opaque("daily-review")
	if err != nil {
		return DailyReview{}, err
	}
	content := workoverviewpersistence.ReviewContent{Summary: input.Summary, Momentum: input.Momentum, Highlights: input.Highlights, Friction: input.Friction, NextStep: input.NextStep}
	if err := s.repository.SaveReview(ctx, input.UserID, input.Date, content, input.AIConfig, reviewID); err != nil {
		return DailyReview{}, err
	}
	return DailyReview{ID: reviewID, Date: input.Date.Format("2006-01-02"), Summary: input.Summary, Momentum: input.Momentum, Highlights: input.Highlights, Friction: input.Friction, NextStep: input.NextStep, AIConfig: input.AIConfig, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
