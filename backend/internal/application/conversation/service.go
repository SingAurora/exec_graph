// Package conversation contains conversation application use cases.
package conversation

import (
	"context"
	"encoding/json"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 负责对话与执行节点之间的应用层交接。
type Service struct {
	repository          Repository
	credentials         CredentialProvider
	contributionOrigins ContributionOriginProvider
	modelClient         applicationaigateway.Client
	reviewer            *applicationreview.Service
}

// New 创建对话应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{
		repository:          dependencies.Repository,
		credentials:         dependencies.Credentials,
		contributionOrigins: dependencies.ContributionOrigins,
		modelClient:         dependencies.ModelClient,
		reviewer:            dependencies.Reviewer,
	}
}

// CopyPlanningMessagesToNode 将规划对话的原始消息复制到节点公开记录。
// 复制失败只返回错误，由调用方决定是否采用 best-effort 策略。
func (s *Service) CopyPlanningMessagesToNode(ctx context.Context, conversationID, nodeID string, userID uint64) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.repository.ListPlanningMessages(ctx, conversationID, userID)
	if err != nil {
		return err
	}
	messages := make([]map[string]any, 0)
	for _, row := range rows {
		speaker := "user"
		if row.Role == "assistant" {
			speaker = "ai"
		}
		messages = append(messages, map[string]any{"uuid": row.UUID, "speaker": speaker, "body": row.Body, "createdAt": row.CreatedAt})
	}
	messageID, err := sharedid.UUID()
	if err != nil {
		return err
	}
	messages = append(messages, map[string]any{"uuid": messageID, "speaker": "ai", "body": "目标对话已完成，行动草案已经足够清楚；目标、做到位清单和记录要求已保存。", "createdAt": time.Now()})
	encoded, err := json.Marshal(messages)
	if err != nil {
		return err
	}
	if err := s.repository.UpdateReviewMessages(ctx, nodeID, string(encoded)); err != nil {
		return err
	}
	return nil
}
