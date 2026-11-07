package generation

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"strconv"
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
	// 客户端离开会取消 HTTP 请求 context；生成已受理后必须继续完成并落库，
	// 重新进入工作区时再由同一幂等键读取或轮询结果。
	return s.process(context.WithoutCancel(ctx), actor, input.Mode, input.ParentID != "", initialProvider, *pending, messages)
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
	// 生成阶段不自动核验；用户点击“核验”或明确输入核验后，前端才对草稿执行核验。
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
			message := "这次整理中有内容无法对应到你的报告。请确认行动、结果和想法都属于本次经历后重试"
			switch mode {
			case "expression":
				message = "表达没有通过核验。事实性内容需要有行动依据，兴趣和态度保持主观后重试"
			case "agreement":
				message = "约定没有通过核验。请把约定写得更具体、可判断后重试"
			}
			return View{}, errors.Join(fault.New(fault.Invalid, message), err)
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

// Verify 对已经成功生成的草稿执行一次显式核验，只返回一条结果，不自动改写或发布。
func (s *Service) Verify(ctx context.Context, actor identity.Actor, input VerifyInput) (VerifyView, error) {
	if !id.Valid(input.GenerationID) {
		return VerifyView{}, fault.New(fault.Invalid, "生成标识不合法")
	}
	var data VerificationContext
	err := s.store.Within(ctx, actor, func(tx Transaction) error {
		var loadErr error
		data, loadErr = tx.VerifyContext(input.GenerationID)
		return loadErr
	})
	if err != nil {
		return VerifyView{}, err
	}
	snapshot := contextSnapshot{Mode: data.Mode, ActorID: data.ActorID, NodeID: data.NodeID, Guide: data.Guide, HasParent: data.HasParent, Reports: []report{}, Facts: []fact{}, Sources: []source{}}
	for _, item := range data.Reports {
		snapshot.Reports = append(snapshot.Reports, report{ID: item.ID, Text: item.Text})
	}
	for _, node := range data.Graph.Nodes {
		snapshot.Facts = append(snapshot.Facts, fact{NodeID: node.ID, Number: node.Number, ActorID: node.AuthorID, Title: node.Title, Objective: node.Objective})
		if data.Mode != "action" && node.ID == data.NodeID {
			snapshot.CurrentExpression, snapshot.CurrentAgreement = node.Expression.Markdown, node.Agreement.Markdown
		}
	}
	byNode := map[string]struct{ expression, agreement string }{}
	for _, node := range data.Graph.Nodes {
		byNode[node.ID] = struct{ expression, agreement string }{node.Expression.Markdown, node.Agreement.Markdown}
	}
	for _, src := range data.Sources {
		docs := byNode[src.NodeID]
		snapshot.Sources = append(snapshot.Sources, source{NodeID: src.NodeID, Expression: docs.expression, Agreement: docs.agreement})
	}
	result := VerifyView{GenerationID: input.GenerationID, SourceReviews: data.Draft.Reviews}
	checks, promptErr := verificationPrompt(snapshot, data.Draft)
	if promptErr != nil {
		result.Status, result.Message = "failed", "当前草稿暂时无法核验，请检查来源后重试。"
		return result, nil
	}
	verifier := s.analysisProvider
	if data.Mode == "action" {
		verifier = s.draftProvider
	}
	if verifier == nil || verifier.Model() == "" {
		result.Status, result.Message = "failed", "平台核验暂未启用。"
		return result, nil
	}
	verifyCtx, cancel := context.WithTimeout(ctx, constants.AITimeout)
	checked, verifyErr := verifier.Complete(verifyCtx, checks)
	cancel()
	if verifyErr != nil {
		result.Status, result.Message = "failed", "核验暂时没有完成，请稍后重试。"
		return result, nil
	}
	verified, verifyErr := verify(checked.Content, snapshot, data.Draft)
	if verifyErr != nil {
		result.Status, result.Message = "failed", verificationFailureMessage(data.Mode)
		return result, nil
	}
	result.Status, result.SourceReviews = "passed", verified.Reviews
	unknown := 0
	for _, review := range verified.Reviews {
		if review.Complies == nil {
			unknown++
		}
	}
	if unknown > 0 {
		result.Message = "核验通过。" + strconv.Itoa(unknown) + " 条来源约定尚未提及，可在约定栏查看。"
	} else {
		result.Message = "核验通过，当前草稿可以发布。"
	}
	return result, nil
}

func verificationFailureMessage(mode string) string {
	switch mode {
	case "expression":
		return "表达没有通过核验。请检查事实依据、主观表达和目标效果后重试。"
	case "agreement":
		return "约定没有通过核验。请把约定写得具体、可判断，并与当前行动相关。"
	default:
		return "行动没有通过核验。请检查行动主线、关键动作依据和目标效果后重试。"
	}
}

// Chat 在已有草稿时让模型决定继续整理还是核验；没有草稿时直接生成。
func (s *Service) Chat(ctx context.Context, actor identity.Actor, key string, input ChatInput) (ChatView, error) {
	if input.GenerationID == "" || !id.Valid(input.GenerationID) || len(input.Messages) == 0 {
		view, err := s.Generate(ctx, actor, key, input.GenerateInput)
		if err != nil {
			return ChatView{}, err
		}
		return ChatView{Kind: "generation", Generation: &view}, nil
	}
	if s.shouldVerify(ctx, input.Messages[len(input.Messages)-1]) {
		verified, err := s.Verify(ctx, actor, VerifyInput{GenerationID: input.GenerationID})
		if err != nil {
			return ChatView{}, err
		}
		return ChatView{Kind: "verification", Verification: &verified}, nil
	}
	view, err := s.Generate(ctx, actor, key, input.GenerateInput)
	if err != nil {
		return ChatView{}, err
	}
	return ChatView{Kind: "generation", Generation: &view}, nil
}

const chatIntentRules = `你是引序平台的对话路由器。当前存在一份尚未发布的行动草稿。
判断用户最新消息是不是要求“核验当前草稿”：例如检查、核验、核对来源、判断能不能发布、看看有没有问题。
如果是在要求核验，只返回 {"tool":"verify_draft"}。
否则返回 {"tool":"generate_draft"}。
只返回这个 JSON，不要解释，不要生成行动内容。`

func (s *Service) shouldVerify(ctx context.Context, message string) bool {
	if s.draftProvider == nil || s.draftProvider.Model() == "" || strings.TrimSpace(message) == "" {
		return false
	}
	intentCtx, cancel := context.WithTimeout(ctx, constants.AITimeout)
	defer cancel()
	completion, err := s.draftProvider.Complete(intentCtx, []Message{{Role: "system", Content: chatIntentRules}, {Role: "user", Content: message}})
	if err != nil {
		return false
	}
	var result struct {
		Tool string `json:"tool"`
	}
	if json.Unmarshal([]byte(strings.TrimSpace(completion.Content)), &result) != nil {
		return false
	}
	return result.Tool == "verify_draft"
}
