package endpoint

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

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

func (s *Server) handleWorkOverview(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
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
	days, err := s.loadDailyWorkDays(ctx, user.ID, monthStart, monthStart.AddDate(0, 1, 0))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取工作月历失败")
		return
	}
	writeJSON(w, http.StatusOK, workOverviewResponse{Month: monthStart.Format("2006-01"), Days: days})
}

func (s *Server) handleDailyWorkReview(w http.ResponseWriter, r *http.Request, userID uint64, dateValue string) {
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
	days, err := s.loadDailyWorkDays(ctx, userID, date, date.AddDate(0, 0, 1))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当日工作记录失败")
		return
	}
	if len(days) == 0 || len(days[0].Activities) == 0 {
		writeError(w, http.StatusBadRequest, "这一天还没有可供分析的工作记录")
		return
	}
	key, err := s.loadWorkOverviewAIKey(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
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
	review, err := s.saveDailyWorkReview(ctx, userID, date, key.snapshot(), modelOutput)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存日结分析失败")
		return
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE uuid = ? AND user_id = ?`, key.UUID, userID)
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

func (s *Server) loadDailyWorkDays(ctx context.Context, userID uint64, start, end time.Time) ([]dailyWorkDayResponse, error) {
	byDate := map[string]*dailyWorkDayResponse{}
	add := func(activity dailyWorkActivityResponse) {
		date := activity.CreatedAt.In(time.Local).Format("2006-01-02")
		day := byDate[date]
		if day == nil {
			day = &dailyWorkDayResponse{Date: date, Activities: make([]dailyWorkActivityResponse, 0)}
			byDate[date] = day
		}
		day.Activities = append(day.Activities, activity)
	}

	nodes, err := s.db.QueryContext(ctx, `
		SELECT n.uuid, p.uuid, p.title, n.title, n.verifiable_goal, n.created_at, n.started_at, n.ended_at
		FROM execution_contracts n
		JOIN projects p ON p.id = n.project_id
		WHERE n.actor_id = ? AND p.owner_id = ? AND COALESCE(n.started_at, n.created_at) >= ? AND COALESCE(n.started_at, n.created_at) < ?
		ORDER BY n.created_at ASC`, userID, userID, start, end)
	if err != nil {
		return nil, err
	}
	for nodes.Next() {
		var activity dailyWorkActivityResponse
		var startedAt, endedAt sql.NullTime
		if err := nodes.Scan(&activity.ID, &activity.ProjectID, &activity.ProjectTitle, &activity.Title, &activity.Detail, &activity.CreatedAt, &startedAt, &endedAt); err != nil {
			nodes.Close()
			return nil, err
		}
		activity.Kind = "started"
		activity.NodeID = activity.ID
		if startedAt.Valid {
			activity.StartedAt = &startedAt.Time
			activity.CreatedAt = startedAt.Time
		}
		if endedAt.Valid {
			activity.EndedAt = &endedAt.Time
		}
		activity.ID = "node:" + activity.ID
		add(activity)
	}
	if err := nodes.Err(); err != nil {
		nodes.Close()
		return nil, err
	}
	nodes.Close()

	records, err := s.db.QueryContext(ctx, `
		SELECT r.uuid, p.uuid, p.title, n.uuid, r.title, r.summary, r.record_kind, r.created_at
		FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		WHERE p.owner_id = ? AND r.created_at >= ? AND r.created_at < ?
		ORDER BY r.created_at ASC`, userID, start, end)
	if err != nil {
		return nil, err
	}
	for records.Next() {
		var activity dailyWorkActivityResponse
		var recordKind string
		if err := records.Scan(&activity.ID, &activity.ProjectID, &activity.ProjectTitle, &activity.NodeID, &activity.Title, &activity.Detail, &recordKind, &activity.CreatedAt); err != nil {
			records.Close()
			return nil, err
		}
		if recordKind == "sealed" {
			activity.Kind = "sealed"
		} else {
			activity.Kind = "completed"
		}
		add(activity)
	}
	if err := records.Err(); err != nil {
		records.Close()
		return nil, err
	}
	records.Close()

	reviews, err := s.loadDailyWorkReviews(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}
	for date, review := range reviews {
		day := byDate[date]
		if day == nil {
			day = &dailyWorkDayResponse{Date: date, Activities: make([]dailyWorkActivityResponse, 0)}
			byDate[date] = day
		}
		day.Review = &review
	}

	days := make([]dailyWorkDayResponse, 0, len(byDate))
	for _, day := range byDate {
		sort.Slice(day.Activities, func(left, right int) bool {
			return day.Activities[left].CreatedAt.Before(day.Activities[right].CreatedAt)
		})
		days = append(days, *day)
	}
	sort.Slice(days, func(left, right int) bool { return days[left].Date < days[right].Date })
	return days, nil
}

func (s *Server) loadDailyWorkReviews(ctx context.Context, userID uint64, start, end time.Time) (map[string]dailyWorkReviewResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT uuid, DATE_FORMAT(review_date, '%Y-%m-%d'), review_json, ai_config_json, created_at, updated_at
		FROM daily_work_reviews
		WHERE user_id = ? AND review_date >= ? AND review_date < ?`, userID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	reviews := map[string]dailyWorkReviewResponse{}
	for rows.Next() {
		var review dailyWorkReviewResponse
		var date string
		var reviewJSON, configJSON string
		if err := rows.Scan(&review.ID, &date, &reviewJSON, &configJSON, &review.CreatedAt, &review.UpdatedAt); err != nil {
			return nil, err
		}
		if json.Unmarshal([]byte(reviewJSON), &review) != nil || json.Unmarshal([]byte(configJSON), &review.AIConfig) != nil {
			continue
		}
		review.Date = date
		reviews[date] = review
	}
	return reviews, rows.Err()
}

func (s *Server) loadWorkOverviewAIKey(ctx context.Context, userID uint64) (aiStoredKey, error) {
	var projectID string
	err := s.db.QueryRowContext(ctx, `
		SELECT uuid FROM projects
		WHERE owner_id = ? AND archived_at IS NULL AND default_ai_key_id IS NOT NULL
		ORDER BY updated_at DESC LIMIT 1`, userID).Scan(&projectID)
	if err != nil {
		return aiStoredKey{}, err
	}
	return s.loadProjectAIKey(ctx, userID, projectID)
}

func analyzeDailyWork(ctx context.Context, key aiStoredKey, date string, activities []dailyWorkActivityResponse) (dailyWorkReviewModelOutput, error) {
	var output dailyWorkReviewModelOutput
	system := "你是 ExecG 的私人日结分析助手。仅根据当天已经记录的工作活动，概括推进情况和下一步。不得把未记录的工作当事实，不做人格判断、道德评价或量化评分，不得改变节点验收、冻结或完成结论。momentum 只能是：稳步推进、集中完成、起步探索、受阻待续。highlights 和 friction 最多各三条；没有阻碍时 friction 为空数组。只返回 JSON。"
	payload := map[string]any{
		"date":       date,
		"activities": activities,
		"requiredJSONResponse": map[string]any{
			"summary":    "基于记录的中文日结摘要",
			"momentum":   "稳步推进|集中完成|起步探索|受阻待续",
			"highlights": []string{"不超过三条具体已记录事实"},
			"friction":   []string{"不超过三条已记录的阻碍，可为空"},
			"nextStep":   "一项具体、可开始的下一步",
		},
	}
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

func (s *Server) saveDailyWorkReview(ctx context.Context, userID uint64, date time.Time, config aiConfigSnapshot, output dailyWorkReviewModelOutput) (dailyWorkReviewResponse, error) {
	dateValue := date.Format("2006-01-02")
	var reviewID string
	var createdAt time.Time
	err := s.db.QueryRowContext(ctx, `SELECT uuid, created_at FROM daily_work_reviews WHERE user_id = ? AND review_date = ?`, userID, dateValue).Scan(&reviewID, &createdAt)
	if errors.Is(err, sql.ErrNoRows) {
		var idErr error
		reviewID, idErr = newOpaqueID("daily-review")
		if idErr != nil {
			return dailyWorkReviewResponse{}, idErr
		}
		createdAt = time.Now()
	} else if err != nil {
		return dailyWorkReviewResponse{}, err
	}
	now := time.Now()
	review := dailyWorkReviewResponse{ID: reviewID, Date: dateValue, Summary: output.Summary, Momentum: output.Momentum, Highlights: output.Highlights, Friction: output.Friction, NextStep: output.NextStep, AIConfig: config, CreatedAt: createdAt, UpdatedAt: now}
	reviewJSON, err := json.Marshal(review)
	if err != nil {
		return dailyWorkReviewResponse{}, err
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return dailyWorkReviewResponse{}, err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO daily_work_reviews (uuid, user_id, review_date, review_json, ai_config_json)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE review_json = VALUES(review_json), ai_config_json = VALUES(ai_config_json)`, reviewID, userID, dateValue, reviewJSON, configJSON)
	return review, err
}
