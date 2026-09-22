package project

import (
	"context"
	"encoding/json"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// ConfirmNodeCompletion 根据最近一次 AI 审查结果创建完成记录，并关闭当前推进。
func (s *Service) ConfirmNodeCompletion(ctx context.Context, userID uint64, projectID, nodeID string) (State, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	state, err := s.GetProjectExecutionState(ctx, userID, projectID)
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
	note := "我确认这份行动记录如实反映了当前现实情况，并保存这次推进覆盖的节点。"
	summary := "行动记录已由本人确认；这条阶段记录覆盖 1 个推进节点。AI 只提供记录分析，不证明现实结果。"
	if verdict != "pass" {
		recordKind, terminalStage = "sealed", "sealed"
		note = "我已看到行动记录中的缺口，决定先保存这次推进；后续情况需要继续观察或另建行动。"
		summary = "行动记录仍有缺口，本人决定先保存这次推进；保留节点和材料，后续可以继续观察或补充。"
	}
	verdictJSON, err := json.Marshal(map[string]any{"result": map[bool]string{true: "confirmed_complete", false: "sealed_with_ai_gap"}[verdict == "pass"], "note": note, "createdAt": now})
	if err != nil {
		return State{}, err
	}
	messages, _ := json.Marshal(node.ReviewMessages)
	var messageList []any
	_ = json.Unmarshal(messages, &messageList)
	messageID, err := sharedid.UUID()
	if err != nil {
		return State{}, err
	}
	messageList = append(messageList, map[string]any{"uuid": messageID, "speaker": "user", "body": note, "createdAt": now})
	messagesJSON, err := json.Marshal(messageList)
	if err != nil {
		return State{}, err
	}
	recordID, err := sharedid.UUID()
	if err != nil {
		return State{}, err
	}
	err = s.execution.LockNode(ctx, LockNodeRecord{UserID: userID, ProjectID: projectID, NodeID: nodeID, RecordID: recordID, ReviewID: reviewID, ReviewVerdict: verdict, Title: node.Title, Summary: summary, SmartContractVersion: node.SmartContractVersion, RecordKind: recordKind, TerminalStage: terminalStage, VerdictJSON: string(verdictJSON), MessagesJSON: string(messagesJSON)})
	if err != nil {
		return State{}, err
	}
	return s.GetProjectExecutionState(ctx, userID, projectID)
}
