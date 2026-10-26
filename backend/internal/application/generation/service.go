package generation

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 管理输入快照、网络调用和结果落库三个独立步骤。
type Service struct {
	store    Store
	provider Provider
	limits   Limits
}

// New 创建平台生成用例。
func New(store Store, provider Provider, limits Limits) *Service {
	return &Service{store, provider, limits}
}

// Generate 首次调用同步生成；重复键只读取原任务，不再次计费或重复写消息。
func (s *Service) Generate(ctx context.Context, actor identity.Actor, key string, input GenerateInput) (View, error) {
	var out View
	if !id.Valid(key) || !id.Valid(input.GraphID) || (input.ConversationID != "" && !id.Valid(input.ConversationID)) || strings.TrimSpace(input.Message) == "" || utf8.RuneCountInString(input.Message) > constants.AIInputLimit || input.MergedParentIDs == nil || input.SourceVersions == nil || (input.Mode != "action" && input.Mode != "expression") {
		return out, fault.New(fault.Invalid, "生成输入、来源列表或提交键不合法")
	}
	if s.provider.Model() == "" {
		return out, fault.New(fault.Unavailable, "平台 AI 暂未启用")
	}
	if input.Mode == "expression" && (!id.Valid(input.NodeID) || input.ExpectedVersion == 0 || input.ParentID != "" || len(input.MergedParentIDs) != 0 || len(input.SourceVersions) != 0) {
		return out, fault.New(fault.Invalid, "表达生成需要当前节点与版本，不能改变引用")
	}
	if input.Mode == "action" && (input.NodeID != "" || input.ExpectedVersion != 0) {
		return out, fault.New(fault.Invalid, "新行动不能携带已有节点身份")
	}
	if err := action.ValidateDocument(input.Agreement, input.ParentID != "" || input.Mode == "expression"); err != nil {
		return out, err
	}
	encoded, err := json.Marshal(input)
	if err != nil {
		return out, err
	}
	digest := sha256.Sum256(encoded)
	var messages []Message
	var pending *Pending
	err = s.store.Within(ctx, actor, func(tx Transaction) error {
		previous, err := tx.Existing(key)
		if err != nil {
			return err
		}
		if previous != nil {
			if !bytes.Equal(previous.Digest, digest[:]) {
				return fault.New(fault.Conflict, "同一生成提交键不能用于不同输入")
			}
			out = previous.View
			return nil
		}
		now := time.Now().UTC()
		usage, err := tx.Usage(now)
		if err != nil {
			return err
		}
		if err := s.limits.Check(usage); err != nil {
			return err
		}
		batch, request, err := prepare(tx, actor, key, input, digest[:], s.provider.Model(), now)
		if err != nil {
			return err
		}
		if err := tx.Reserve(batch); err != nil {
			return err
		}
		pending, messages = &batch, request
		out = View{GenerationID: batch.ID, ConversationID: batch.Conversation.ID, Status: "pending"}
		return nil
	})
	if err != nil || pending == nil {
		return out, err
	}
	completion, callError := s.provider.Complete(ctx, messages)
	var draft Draft
	if callError == nil {
		draft, callError = parse(completion.Content, input.Mode, input.ParentID != "", pending.Sources)
	}
	// 请求取消也要尽量结束 pending，避免同一对话永远被占用。
	finishCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), constants.HTTPRequestTimeout)
	defer cancel()
	err = s.store.Within(finishCtx, actor, func(tx Transaction) error {
		if callError != nil {
			return tx.Fail(pending.ID, "provider_failed")
		}
		if err := tx.Complete(pending.ID, draft, completion.InputTokens, completion.OutputTokens); err != nil {
			return err
		}
		var err error
		out, err = tx.Get(pending.ID)
		return err
	})
	if callError != nil {
		return View{}, errors.Join(fault.New(fault.Unavailable, "AI 整理失败，请稍后重新发送"), err)
	}
	return out, err
}

// Get 只读取当前账号发起的结果，支持重试请求收到 pending 后继续查询。
func (s *Service) Get(ctx context.Context, actor identity.Actor, uuid string) (View, error) {
	var out View
	if !id.Valid(uuid) {
		return out, fault.New(fault.Invalid, "生成标识不合法")
	}
	err := s.store.Within(ctx, actor, func(tx Transaction) error { var err error; out, err = tx.Get(uuid); return err })
	return out, err
}

func prepare(tx Transaction, actor identity.Actor, key string, input GenerateInput, digest []byte, model string, now time.Time) (Pending, []Message, error) {
	batch := Pending{ID: id.New(), RequestKey: key, ActorID: actor.UserID, Mode: input.Mode, GraphID: input.GraphID, NodeID: input.NodeID, ExpectedVersion: input.ExpectedVersion, Model: model, Digest: digest, InputMessage: strings.TrimSpace(input.Message), Agreement: input.Agreement, CreatedAt: now}
	graph, err := tx.Graph(input.GraphID)
	if err != nil {
		return batch, nil, err
	}
	batch.Guide = graph.Guide
	starts := []string{}
	if input.Mode == "action" {
		reviews := []action.SourceAssessment{}
		if input.ParentID != "" {
			starts = append(starts, input.ParentID)
		}
		starts = append(starts, input.MergedParentIDs...)
		for _, uuid := range starts {
			reviews = append(reviews, action.SourceAssessment{SourceID: uuid, Provided: true})
		}
		batch.Sources, _, _, err = action.ResolveSources(graph, action.CreateActionInput{ParentID: input.ParentID, MergedParentIDs: input.MergedParentIDs, SourceVersions: input.SourceVersions, ReferenceAgreements: reviews})
		if err != nil {
			return batch, nil, err
		}
		if len(batch.Sources) > 0 {
			batch.InheritedExpressionID = batch.Sources[0].ExpressionID
		}
	} else {
		node, err := action.EditableNode(graph, input.NodeID, input.ExpectedVersion)
		if err != nil {
			return batch, nil, err
		}
		batch.InheritedExpressionID, starts = node.Expression.ID, []string{node.ID}
	}
	batch.Conversation, err = tx.Conversation(input)
	if err != nil {
		return batch, nil, err
	}
	facts, err := tx.Facts(graph.ID)
	if err != nil {
		return batch, nil, err
	}
	request, err := prompt(graph, action.HistoryNodeIDs(graph, starts), facts, batch, input.ParentID != "")
	if err == nil {
		encoded, encodeError := json.Marshal(request)
		if encodeError != nil {
			return batch, nil, encodeError
		}
		digest := sha256.Sum256(encoded)
		batch.ContextDigest = digest[:]
	}
	return batch, request, err
}
