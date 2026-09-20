// Package workoverview contains daily activity and review use cases.
package workoverview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository  Repository
	credentials CredentialProvider
	modelClient applicationaigateway.Client
}

// New 创建工作总览应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{repository: dependencies.Repository, credentials: dependencies.Credentials, modelClient: dependencies.ModelClient}
}

// ListDailyActivity 返回时间范围内按日期分组的行动记录和日结。
func (s *Service) ListDailyActivity(ctx context.Context, userID uint64, start, end time.Time) ([]Day, error) {
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

// SaveDailyActivityReview 保存一天的 AI 行动分析。
func (s *Service) SaveDailyActivityReview(ctx context.Context, input SaveReviewInput) (DailyReview, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DailyWorkReviewTimeout)
	defer cancel()
	reviewID, err := sharedid.UUID()
	if err != nil {
		return DailyReview{}, err
	}
	content := ReviewContent{Summary: input.Summary, Momentum: input.Momentum, Highlights: input.Highlights, Friction: input.Friction, NextStep: input.NextStep}
	if err := s.repository.SaveReview(ctx, input.UserID, input.Date, content, input.AIConfig, reviewID); err != nil {
		return DailyReview{}, err
	}
	return DailyReview{ID: reviewID, Date: input.Date.Format("2006-01-02"), Summary: input.Summary, Momentum: input.Momentum, Highlights: input.Highlights, Friction: input.Friction, NextStep: input.NextStep, AIConfig: input.AIConfig, CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}

// ReviewDailyActivity 使用已配置的 AI 分析指定日期的行动记录并保存日结。
func (s *Service) ReviewDailyActivity(ctx context.Context, userID uint64, date time.Time) (DailyReview, error) {
	today := time.Now().In(time.Local)
	if date.After(time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.Local)) {
		return DailyReview{}, fault.New(fault.InvalidRequest, "不能分析未来日期")
	}
	days, err := s.ListDailyActivity(ctx, userID, date, date.AddDate(0, 0, 1))
	if err != nil {
		return DailyReview{}, fault.Wrap(fault.Internal, "读取当日工作记录失败", err)
	}
	if len(days) == 0 || len(days[0].Activities) == 0 {
		return DailyReview{}, fault.New(fault.InvalidRequest, "这一天还没有可供分析的工作记录")
	}
	key, err := s.credentials.FindLatestProjectReviewKey(ctx, userID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		return DailyReview{}, fault.New(fault.InvalidRequest, "请先为至少一个未归档项目选择审查 AI")
	}
	if err != nil {
		return DailyReview{}, fault.Wrap(fault.Internal, "读取日结 AI 配置失败", err)
	}
	output, err := s.analyzeDailyWork(ctx, key, date.Format("2006-01-02"), days[0].Activities)
	if err != nil {
		return DailyReview{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	configuration := applicationreview.AIConfigSnapshot{KeyID: key.ID, Label: key.Label, Provider: key.Provider, Model: key.Model, BaseURL: key.BaseURL}
	configJSON, err := json.Marshal(configuration)
	if err != nil {
		return DailyReview{}, fault.Wrap(fault.Internal, "保存日结分析失败", err)
	}
	if err := s.credentials.MarkAIKeyUsed(ctx, userID, key.ID); err != nil {
		return DailyReview{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	review, err := s.SaveDailyActivityReview(ctx, SaveReviewInput{UserID: userID, Date: date, Summary: output.Summary, Momentum: output.Momentum, Highlights: output.Highlights, Friction: output.Friction, NextStep: output.NextStep, AIConfig: string(configJSON)})
	if err != nil {
		return DailyReview{}, fault.Wrap(fault.Internal, "保存日结分析失败", err)
	}
	return review, nil
}

type dailyReviewModelOutput struct {
	Summary    string   `json:"summary"`
	Momentum   string   `json:"momentum"`
	Highlights []string `json:"highlights"`
	Friction   []string `json:"friction"`
	NextStep   string   `json:"nextStep"`
}

func (s *Service) analyzeDailyWork(ctx context.Context, key applicationaikey.Credential, date string, activities []Activity) (dailyReviewModelOutput, error) {
	var output dailyReviewModelOutput
	system := "你是 ExecG 的私人日结分析助手。仅根据当天已经记录的工作活动，概括推进情况和下一步。不得把未记录的工作当事实，不做人格判断、道德评价或量化评分，不得改变节点验收、冻结或完成结论。momentum 只能是：稳步推进、集中完成、起步探索、受阻待续。highlights 和 friction 最多各三条；没有阻碍时 friction 为空数组。只返回 JSON。"
	payload := struct {
		Date                 string                 `json:"date"`
		Activities           []Activity             `json:"activities"`
		RequiredJSONResponse dailyReviewModelOutput `json:"requiredJSONResponse"`
	}{Date: date, Activities: activities, RequiredJSONResponse: dailyReviewModelOutput{Summary: "基于记录的中文日结摘要", Momentum: "稳步推进|集中完成|起步探索|受阻待续", Highlights: []string{"不超过三条具体已记录事实"}, Friction: []string{"不超过三条已记录的阻碍，可为空"}, NextStep: "一项具体、可开始的下一步"}}
	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return output, err
	}
	credential := applicationaigateway.Credential{Provider: key.Provider, APIKey: key.Secret, BaseURL: key.BaseURL, Model: key.Model}
	if err := applicationaigateway.GenerateJSON(ctx, s.modelClient, applicationaigateway.GenerateInput{Credential: credential, System: system, User: string(content), MaxTokens: 8192, JSONMode: true}, &output); err != nil {
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

func uniqueNonEmpty(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
