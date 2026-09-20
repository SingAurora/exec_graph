package workflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationworkoverview "github.com/singaurora/exec-graph/backend/internal/application/workoverview"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type dailyWorkActivityResponse struct {
	ID           string     `json:"id"`
	Kind         string     `json:"kind"`
	ProjectID    string     `json:"projectId"`
	ProjectTitle string     `json:"projectTitle"`
	NodeID       string     `json:"nodeId,omitempty"`
	Title        string     `json:"title"`
	Detail       string     `json:"detail,omitempty"`
	CreatedAt    time.Time  `json:"createdAt"`
	StartedAt    *time.Time `json:"startedAt,omitempty"`
	EndedAt      *time.Time `json:"endedAt,omitempty"`
}

type dailyWorkReviewResponse struct {
	ID         string           `json:"id"`
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

type dailyWorkReviewModelOutput struct {
	Summary    string   `json:"summary"`
	Momentum   string   `json:"momentum"`
	Highlights []string `json:"highlights"`
	Friction   []string `json:"friction"`
	NextStep   string   `json:"nextStep"`
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

func (h *Handler) handleWorkOverview(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	monthStart, err := parseOverviewMonth(r.URL.Query().Get("month"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "月份格式应为 YYYY-MM")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.WorkOverviewTimeout)
	defer cancel()
	days, err := h.loadDailyWorkDays(ctx, user.ID, monthStart, monthStart.AddDate(0, 1, 0))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取工作月历失败")
		return
	}
	writeJSON(w, http.StatusOK, workOverviewResponse{Month: monthStart.Format("2006-01"), Days: days})
}

func (h *Handler) handleDailyWorkReview(w http.ResponseWriter, r *http.Request, userID uint64, dateValue string) {
	if strings.TrimSpace(dateValue) == "" {
		var request dailyWorkReviewRequest
		if !bindJSON(w, r, &request) {
			return
		}
		dateValue = request.Date
	}
	date, err := time.ParseInLocation("2006-01-02", dateValue, time.Local)
	if err != nil {
		writeError(w, http.StatusBadRequest, "日期格式应为 YYYY-MM-DD")
		return
	}
	today := time.Now().In(time.Local)
	if date.After(time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.Local)) {
		writeError(w, http.StatusBadRequest, "不能分析未来日期")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DailyWorkReviewTimeout)
	defer cancel()
	days, err := h.loadDailyWorkDays(ctx, userID, date, date.AddDate(0, 0, 1))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当日工作记录失败")
		return
	}
	if len(days) == 0 || len(days[0].Activities) == 0 {
		writeError(w, http.StatusBadRequest, "这一天还没有可供分析的工作记录")
		return
	}
	key, err := h.loadWorkOverviewAIKey(ctx, userID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		writeError(w, http.StatusBadRequest, "请先为至少一个未归档项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取日结 AI 配置失败")
		return
	}
	modelOutput, err := analyzeDailyWork(ctx, key, date.Format("2006-01-02"), days[0].Activities)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	review, err := h.saveDailyWorkReview(ctx, userID, date, key.snapshot(), modelOutput)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存日结分析失败")
		return
	}
	_ = h.aiKey.MarkUsed(ctx, userID, key.UUID)
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
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
	days, err := h.workOverview.ListDays(ctx, userID, start, end)
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

func (h *Handler) loadWorkOverviewAIKey(ctx context.Context, userID uint64) (aiStoredKey, error) {
	key, err := h.aiKey.FindLatestProjectReviewKey(ctx, userID)
	if err != nil {
		return aiStoredKey{}, err
	}
	return aiStoredKey{UUID: key.ID, Provider: key.Provider, Label: key.Label, APIKey: key.APIKey, BaseURL: key.BaseURL, Model: key.Model}, nil
}

func analyzeDailyWork(ctx context.Context, key aiStoredKey, date string, activities []dailyWorkActivityResponse) (dailyWorkReviewModelOutput, error) {
	var output dailyWorkReviewModelOutput
	system := "你是 ExecG 的私人日结分析助手。仅根据当天已经记录的工作活动，概括推进情况和下一步。不得把未记录的工作当事实，不做人格判断、道德评价或量化评分，不得改变节点验收、冻结或完成结论。momentum 只能是：稳步推进、集中完成、起步探索、受阻待续。highlights 和 friction 最多各三条；没有阻碍时 friction 为空数组。只返回 JSON。"
	payload := map[string]any{"date": date, "activities": activities, "requiredJSONResponse": map[string]any{"summary": "基于记录的中文日结摘要", "momentum": "稳步推进|集中完成|起步探索|受阻待续", "highlights": []string{"不超过三条具体已记录事实"}, "friction": []string{"不超过三条已记录的阻碍，可为空"}, "nextStep": "一项具体、可开始的下一步"}}
	if err := callConversationModel(ctx, key, system, payload, &output); err != nil {
		return output, fmt.Errorf("AI 日结分析失败：%w", err)
	}
	output.Summary = strings.TrimSpace(output.Summary)
	output.Momentum = strings.TrimSpace(output.Momentum)
	output.NextStep = strings.TrimSpace(output.NextStep)
	output.Highlights = uniqueNonEmpty(output.Highlights)
	output.Friction = uniqueNonEmpty(output.Friction)
	if output.Summary == "" || output.Momentum == "" || output.NextStep == "" {
		return output, fmt.Errorf("AI 日结分析内容不完整，请重试")
	}
	return output, nil
}

func (h *Handler) saveDailyWorkReview(ctx context.Context, userID uint64, date time.Time, config aiConfigSnapshot, output dailyWorkReviewModelOutput) (dailyWorkReviewResponse, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return dailyWorkReviewResponse{}, err
	}
	review, err := h.workOverview.SaveReview(ctx, applicationworkoverview.SaveReviewInput{UserID: userID, Date: date, Summary: output.Summary, Momentum: output.Momentum, Highlights: output.Highlights, Friction: output.Friction, NextStep: output.NextStep, AIConfig: string(configJSON)})
	if err != nil {
		return dailyWorkReviewResponse{}, err
	}
	return dailyWorkReviewResponse{ID: review.ID, Date: review.Date, Summary: review.Summary, Momentum: review.Momentum, Highlights: review.Highlights, Friction: review.Friction, NextStep: review.NextStep, AIConfig: config, CreatedAt: review.CreatedAt, UpdatedAt: review.UpdatedAt}, nil
}
