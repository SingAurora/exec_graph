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
	rows, err := s.repository.Rows(ctx, `SELECT m.uuid, m.role, m.body, m.created_at FROM node_conversation_messages m JOIN node_conversations c ON c.id = m.conversation_id WHERE c.uuid = ? AND c.owner_id = ? ORDER BY m.created_at ASC, m.uuid ASC`, conversationID, userID)
	if err != nil {
		return err
	}
	defer rows.Close()
	messages := make([]map[string]any, 0)
	for rows.Next() {
		var id, role, body string
		var createdAt time.Time
		if err := rows.Scan(&id, &role, &body, &createdAt); err != nil {
			return err
		}
		speaker := "user"
		if role == "assistant" {
			speaker = "ai"
		}
		messages = append(messages, map[string]any{"id": id, "speaker": speaker, "body": body, "createdAt": createdAt})
	}
	if err := rows.Err(); err != nil {
		return err
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
	if _, err := s.repository.Execute(ctx, `UPDATE execution_contracts SET review_messages_json = ? WHERE uuid = ?`, string(encoded), nodeID); err != nil {
		return err
	}
	return nil
}
