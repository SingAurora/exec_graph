// Package conversation contains conversation application use cases.
package conversation

import (
	"context"
	"encoding/json"
	"time"

	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 负责对话与执行节点之间的应用层交接。
type Service struct {
	repository *conversationpersistence.Repository
}

func New(repository *conversationpersistence.Repository) *Service {
	return &Service{repository: repository}
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
		messages = append(messages, map[string]any{"id": row.UUID, "speaker": speaker, "body": row.Body, "createdAt": row.CreatedAt})
	}
	messageID, err := sharedid.Opaque("message")
	if err != nil {
		return err
	}
	messages = append(messages, map[string]any{"id": messageID, "speaker": "ai", "body": "目标对话已完成，节点草案通过冻结审核，目标、验收标准和证据要求已冻结。", "createdAt": time.Now()})
	encoded, err := json.Marshal(messages)
	if err != nil {
		return err
	}
	if err := s.repository.UpdateReviewMessages(ctx, nodeID, string(encoded)); err != nil {
		return err
	}
	return nil
}
