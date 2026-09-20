package workflow

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type dailyWorkActivityResponse struct {
	ID           string     `json:"uuid"`
	Kind         string     `json:"kind"`
	ProjectID    string     `json:"projectUuid"`
	ProjectTitle string     `json:"projectTitle"`
	NodeID       string     `json:"nodeUuid,omitempty"`
	Title        string     `json:"title"`
	Detail       string     `json:"detail,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	EndedAt      *time.Time `json:"endedAt,omitempty"`
}

type dailyWorkReviewResponse struct {
	ID         string           `json:"uuid"`
	Date       string           `json:"date"`
	Summary    string           `json:"summary"`
	Momentum   string           `json:"momentum"`
	Highlights []string         `json:"highlights"`
	Friction   []string         `json:"friction"`
	NextStep   string           `json:"nextStep"`
	AIConfig   aiConfigSnapshot `json:"aiConfig"`
	CreatedAt  time.Time        `json:"createdAt"`
	UpdatedAt  time.Time        `json:"updatedAt"`
}

type dailyWorkDayResponse struct {
	Date       string                      `json:"date"`
	Activities []dailyWorkActivityResponse `json:"activities"`
	Review     *dailyWorkReviewResponse    `json:"review,omitempty"`
}

type workOverviewResponse struct {
	Month string                 `json:"month"`
	Days  []dailyWorkDayResponse `json:"days"`
}

type dailyWorkReviewRequest struct {
	Date string `json:"date"`
}

type monthlyWorkOverviewQuery struct {
	Month string
}

// GetMonthlyWorkOverview 返回当前用户指定月份内按日分组的行动记录。
func (h *Handler) GetMonthlyWorkOverview(w http.ResponseWriter, r *http.Request, userID uint64) error {
	query := monthlyWorkOverviewQuery{Month: strings.TrimSpace(r.URL.Query().Get("month"))}
	monthStart, err := parseOverviewMonth(query.Month)
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "月份格式应为 YYYY-MM")
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.WorkOverviewTimeout)
	defer cancel()
	days, err := h.loadDailyWorkDays(ctx, userID, monthStart, monthStart.AddDate(0, 1, 0))
	if err != nil {
		return newHTTPError(http.StatusInternalServerError, "读取工作月历失败")
	}
	writeJSON(w, http.StatusOK, workOverviewResponse{Month: monthStart.Format("2006-01"), Days: days})
	return nil
}

// ReviewDailyActivity 使用已配置的 AI 分析指定日期的行动记录。
func (h *Handler) ReviewDailyActivity(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request dailyWorkReviewRequest
	if err := bindJSON(r, &request); err != nil {
		return err
	}
	dateValue := strings.TrimSpace(request.Date)
	date, err := time.ParseInLocation("2006-01-02", dateValue, time.Local)
	if err != nil {
		return newHTTPError(http.StatusBadRequest, "日期格式应为 YYYY-MM-DD")
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DailyWorkReviewTimeout)
	defer cancel()
	review, err := h.workOverview.ReviewDailyActivity(ctx, userID, date)
	if err != nil {
		return err
	}
	var configuration aiConfigSnapshot
	_ = json.Unmarshal([]byte(review.AIConfig), &configuration)
	response := dailyWorkReviewResponse{ID: review.ID, Date: review.Date, Summary: review.Summary, Momentum: review.Momentum, Highlights: review.Highlights, Friction: review.Friction, NextStep: review.NextStep, AIConfig: configuration, CreatedAt: review.CreatedAt, UpdatedAt: review.UpdatedAt}
	writeJSON(w, http.StatusOK, map[string]any{"review": response})
	return nil
}

func parseOverviewMonth(value string) (time.Time, error) {
	if strings.TrimSpace(value) == "" {
		now := time.Now().In(time.Local)
		return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local), nil
	}
	month, err := time.ParseInLocation("2006-01", value, time.Local)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.Local), nil
}

func (h *Handler) loadDailyWorkDays(ctx context.Context, userID uint64, start, end time.Time) ([]dailyWorkDayResponse, error) {
	days, err := h.workOverview.ListDailyActivity(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	result := make([]dailyWorkDayResponse, 0, len(days))
	for _, day := range days {
		responseDay := dailyWorkDayResponse{Date: day.Date, Activities: make([]dailyWorkActivityResponse, 0, len(day.Activities))}
		for _, activity := range day.Activities {
			responseDay.Activities = append(responseDay.Activities, dailyWorkActivityResponse{ID: activity.ID, Kind: activity.Kind, ProjectID: activity.ProjectID, ProjectTitle: activity.ProjectTitle, NodeID: activity.NodeID, Title: activity.Title, Detail: activity.Detail, CreatedAt: activity.CreatedAt, StartedAt: activity.StartedAt, EndedAt: activity.EndedAt})
		}
		if day.Review != nil {
			var config aiConfigSnapshot
			_ = json.Unmarshal([]byte(day.Review.AIConfig), &config)
			responseDay.Review = &dailyWorkReviewResponse{ID: day.Review.ID, Date: day.Review.Date, Summary: day.Review.Summary, Momentum: day.Review.Momentum, Highlights: day.Review.Highlights, Friction: day.Review.Friction, NextStep: day.Review.NextStep, AIConfig: config, CreatedAt: day.Review.CreatedAt, UpdatedAt: day.Review.UpdatedAt}
		}
		result = append(result, responseDay)
	}
	return result, nil
}
