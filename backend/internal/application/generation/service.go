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
	store            Store
	draftProvider    Provider
	analysisProvider Provider
	limits           Limits
}

// New 创建平台生成用例。
func New(store Store, draftProvider, analysisProvider Provider, limits Limits) *Service {
	return &Service{store: store, draftProvider: draftProvider, analysisProvider: analysisProvider, limits: limits}
}

// Generate 首次调用同步生成；重复键只读取原任务，不再次计费或重复写消息。
func (s *Service) Generate(ctx context.Context, actor identity.Actor, key string, input GenerateInput) (View, error) {
	var out View
	if !id.Valid(key) || !id.Valid(input.GraphID) || (input.ConversationID != "" && !id.Valid(input.ConversationID)) || !validInputMessages(input) || input.MergedParentIDs == nil || input.SourceVersions == nil || (input.Mode != "action" && input.Mode != "expression" && input.Mode != "agreement") {
		return out, fault.New(fault.Invalid, "生成输入、来源列表或提交键不合法")
	}
	if !validInputImages(input) || (input.Mode != "action" && len(input.Images) != 0) {
		return out, fault.New(fault.Invalid, "请为每张图片填写备注，图片最多 12 张且备注不超过 30 字")
	}
	initialProvider := s.draftProvider
	if input.Mode == "expression" || input.Mode == "agreement" {
		initialProvider = s.analysisProvider
	}
	if initialProvider == nil || initialProvider.Model() == "" || s.analysisProvider == nil || s.analysisProvider.Model() == "" {
		return out, fault.New(fault.Unavailable, "平台 AI 暂未启用")
	}
	if (input.Mode == "expression" || input.Mode == "agreement") && (!id.Valid(input.NodeID) || input.ExpectedVersion == 0 || input.ParentID != "" || len(input.MergedParentIDs) != 0 || len(input.SourceVersions) != 0) {
		return out, fault.New(fault.Invalid, "表达或约定生成需要当前节点与版本，不能改变引用")
	}
	if input.Mode == "action" && (input.NodeID != "" || input.ExpectedVersion != 0) {
		return out, fault.New(fault.Invalid, "新行动不能携带已有节点身份")
	}
	if err := action.ValidateDocument(input.Agreement, input.ParentID != "" || input.Mode == "expression" || input.Mode == "agreement"); err != nil {
		return out, err
	}
	if input.Mode == "agreement" && input.Agreement.Mode == "inherit" {
		return out, fault.New(fault.Invalid, "约定对话必须提交当前约定快照")
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
		model := "draft=" + s.draftProvider.Model() + ";analysis=" + s.analysisProvider.Model()
		batch, request, err := prepare(tx, actor, key, input, digest[:], model, now)
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
	return s.process(ctx, actor, input.Mode, input.ParentID != "", initialProvider, *pending, messages)
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

func validInputMessages(input GenerateInput) bool {
	if len(input.Messages) == 0 || len(input.Messages) > constants.AIMessageBatchLimit || ((input.Mode == "expression" || input.Mode == "agreement") && len(input.Messages) != 1) {
		return false
	}
	count := 0
	for _, message := range input.Messages {
		if strings.TrimSpace(message) == "" {
			return false
		}
		length := utf8.RuneCountInString(message)
		if length > constants.AIUserMessageLimit {
			return false
		}
		count += length
	}
	return count <= constants.AIInputLimit
}

func (s *Service) process(ctx context.Context, actor identity.Actor, mode string, hasParent bool, initialProvider Provider, pending Pending, messages []Message) (View, error) {
	completion := Completion{}
	draftCtx, cancelDraft := context.WithTimeout(ctx, constants.AITimeout)
	completion, callError := initialProvider.Complete(draftCtx, messages)
	cancelDraft()
	var draft Draft
	if callError == nil {
		draft, callError = parse(completion.Content, mode, hasParent, pending.Sources)
	}
	needsVerification := mode != "action" || len(pending.Sources) > 0
	if callError == nil && needsVerification {
		var checks []Message
		checks, callError = verificationPrompt(pending.snapshot, draft)
		if callError == nil {
			verifyCtx, cancelVerify := context.WithTimeout(ctx, constants.AITimeout)
			verifier := s.analysisProvider
			if mode == "action" {
				verifier = s.draftProvider
			}
			checked, verifyError := verifier.Complete(verifyCtx, checks)
			cancelVerify()
			completion.InputTokens += checked.InputTokens
			completion.OutputTokens += checked.OutputTokens
			callError = verifyError
			if callError == nil {
				draft, callError = verify(checked.Content, pending.snapshot, draft)
			}
		}
	}
	if callError == nil && mode == "action" {
		callError = applyImages(&draft, pending.Images)
	}
	finishCtx, cancelFinish := context.WithTimeout(context.WithoutCancel(ctx), constants.HTTPRequestTimeout)
	defer cancelFinish()
	var out View
	err := s.store.Within(finishCtx, actor, func(tx Transaction) error {
		if callError != nil {
			code := "provider_failed"
			var invalid *fault.Error
			if errors.As(callError, &invalid) && invalid.Code == fault.Invalid {
				code = "content_invalid"
			} else if errors.Is(callError, errUnverified) {
				code = "content_unverified"
			}
			if err := tx.Fail(pending.ID, code); err != nil {
				return err
			}
			return nil
		}
		if err := tx.Complete(pending.ID, draft, completion.InputTokens, completion.OutputTokens); err != nil {
			return err
		}
		var err error
		out, err = tx.Get(pending.ID)
		if err == nil && out.Draft != nil {
			out.Draft.InvalidImages = draft.InvalidImages
		}
		return err
	})
	if callError != nil {
		var invalid *fault.Error
		if errors.As(callError, &invalid) && invalid.Code == fault.Invalid {
			return View{}, errors.Join(callError, err)
		}
		if errors.Is(callError, errUnverified) {
			return View{}, errors.Join(fault.New(fault.Invalid, "这次整理中有内容无法对应到你的报告。请确认行动、结果和想法都属于本次经历后重试"), err)
		}
		return View{}, errors.Join(fault.New(fault.Unavailable, "AI 整理失败，请稍后重新发送"), err)
	}
	return out, err
}

func prepare(tx Transaction, actor identity.Actor, key string, input GenerateInput, digest []byte, model string, now time.Time) (Pending, []Message, error) {
	batch := Pending{ID: id.New(), RequestKey: key, ActorID: actor.UserID, Mode: input.Mode, GraphID: input.GraphID, NodeID: input.NodeID, ExpectedVersion: input.ExpectedVersion, Model: model, Digest: digest, InputMessages: trimMessages(input.Messages), Images: trimImages(input.Images), Agreement: input.Agreement, CreatedAt: now}
	for _, image := range batch.Images {
		if err := tx.CheckAssets(&image.AssetID); err != nil {
			return batch, nil, err
		}
	}
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
		if input.Mode == "agreement" {
			current := action.DocumentUpdate{Mode: "clear"}
			if strings.TrimSpace(node.Agreement.Markdown) != "" {
				markdown := node.Agreement.Markdown
				current = action.DocumentUpdate{Mode: "update", Markdown: &markdown}
			}
			if !sameDocumentUpdate(current, input.Agreement) {
				return batch, nil, fault.New(fault.Conflict, "约定已变化，请重新打开对话")
			}
		}
		batch.InheritedExpressionID, starts = node.Expression.ID, []string{node.ID}
		if input.Mode == "expression" {
			batch.Initial = node.ExpressionStatus != "published"
		} else {
			batch.Initial = node.AgreementStatus != "published"
		}
		batch.CurrentDocument = strings.TrimSpace(input.CurrentDocument)
		if batch.CurrentDocument != "" {
			batch.Initial = false
		}
	}
	batch.Conversation, err = tx.Conversation(input)
	if err != nil {
		return batch, nil, err
	}
	batch.InputThroughSequence = batch.Conversation.NextSequence + uint32(len(batch.InputMessages)) - 1
	facts, err := tx.Facts(graph.ID)
	if err != nil {
		return batch, nil, err
	}
	batch.snapshot = snapshotFor(graph, action.HistoryNodeIDs(graph, starts), facts, batch, input.ParentID != "")
	request, err := prompt(batch.snapshot, batch)
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

func validInputImages(input GenerateInput) bool {
	if len(input.Images) > constants.ActionImageLimit {
		return false
	}
	seen := map[string]bool{}
	for _, image := range input.Images {
		alt := strings.TrimSpace(image.Alt)
		if !id.Valid(image.AssetID) || alt == "" || utf8.RuneCountInString(alt) > constants.ImageAltLimit || seen[strings.ToLower(image.AssetID)] {
			return false
		}
		seen[strings.ToLower(image.AssetID)] = true
	}
	return true
}

func trimImages(images []action.ImageInput) []action.ImageInput {
	trimmed := make([]action.ImageInput, len(images))
	for i, image := range images {
		trimmed[i] = action.ImageInput{AssetID: strings.ToLower(strings.TrimSpace(image.AssetID)), Alt: strings.TrimSpace(image.Alt)}
	}
	return trimmed
}

func trimMessages(messages []string) []string {
	trimmed := make([]string, len(messages))
	for i, message := range messages {
		trimmed[i] = strings.TrimSpace(message)
	}
	return trimmed
}

func sameDocumentUpdate(left, right action.DocumentUpdate) bool {
	if left.Mode != right.Mode {
		return false
	}
	if left.Markdown == nil || right.Markdown == nil {
		return left.Markdown == nil && right.Markdown == nil
	}
	return *left.Markdown == *right.Markdown
}
