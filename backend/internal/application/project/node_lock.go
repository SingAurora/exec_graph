package project

import (
	"context"
	"encoding/json"
	"time"

	executionpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/execution"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// LockNode 根据最近一次 AI 审查结果，创建完成记录并关闭当前推进。
func (s *Service) LockNode(ctx context.Context, userID uint64, projectID, nodeID string) (State, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	state, err := s.State(ctx, userID, projectID)
	if err != nil {
		return State{}, err
	}
	var node ExecutionNodeView
	for _, candidate := range state.Nodes {
		if candidate.ID == nodeID {
			node = candidate
			break
		}
	}
	if node.ID == "" {
		return State{}, ErrNotFound
	}
	review, ok := node.AIReview.(map[string]any)
	if !ok {
		return State{}, &ValidationError{"节点没有可锁定的 AI 审查记录"}
	}
	reviewID, _ := review["id"].(string)
	verdict, _ := review["verdict"].(string)
	if reviewID == "" {
		return State{}, &ValidationError{"节点没有可锁定的 AI 审查记录"}
	}
	now := time.Now()
	recordKind, terminalStage := "accepted", "completed"
	note := "我确认 AI 审查通过的结果属实，并签名锁定这次推进覆盖的节点。"
	summary := "智能合约审查通过，并由本人确认；这条完成记录覆盖 1 个推进节点。"
	if verdict != "pass" {
		recordKind, terminalStage = "sealed", "sealed"
		note = "我已看到 AI 审查指出的缺口，决定封存这次推进；它不会作为已验收成果使用。"
		summary = "AI 审查仍有缺口，本人决定封存这次推进；保留行动节点及其证据，但不记为已验收成果。"
	}
	verdictJSON, err := json.Marshal(map[string]any{"result": map[bool]string{true: "confirmed_complete", false: "sealed_with_ai_gap"}[verdict == "pass"], "note": note, "createdAt": now})
	if err != nil {
		return State{}, err
	}
	messages, _ := json.Marshal(node.ReviewMessages)
	var messageList []any
	_ = json.Unmarshal(messages, &messageList)
	messageID, err := sharedid.Opaque("message")
	if err != nil {
		return State{}, err
	}
	messageList = append(messageList, map[string]any{"id": messageID, "speaker": "user", "body": note, "createdAt": now})
	messagesJSON, err := json.Marshal(messageList)
	if err != nil {
		return State{}, err
	}
	recordID, err := sharedid.Opaque("record")
	if err != nil {
		return State{}, err
	}
	err = s.execution.LockNode(ctx, executionpersistence.LockNodeParams{UserID: userID, ProjectID: projectID, NodeID: nodeID, RecordID: recordID, ReviewID: reviewID, ReviewVerdict: verdict, Title: node.Title, Summary: summary, SmartContractVersion: node.SmartContractVersion, RecordKind: recordKind, TerminalStage: terminalStage, VerdictJSON: string(verdictJSON), MessagesJSON: string(messagesJSON)})
	if err != nil {
		return State{}, err
	}
	return s.State(ctx, userID, projectID)
}
