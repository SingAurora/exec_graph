package generation

import (
	"encoding/json"
	"errors"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

var errUnverified = errors.New("生成内容未通过行动依据核验")

type evidence struct {
	Kind  string `json:"kind"`
	ID    string `json:"id"`
	Quote string `json:"quote"`
}

type documentCheck struct {
	Valid    *bool      `json:"valid"`
	Message  string     `json:"message,omitempty"`
	Evidence []evidence `json:"evidence"`
}

type verificationFailure struct{ message string }

func (e *verificationFailure) Error() string { return e.message }
func (e *verificationFailure) Unwrap() error { return errUnverified }

func verificationFailureFor(result verification) error {
	for _, message := range []string{result.Action.Message, result.Expression.Message, result.Agreement.Message} {
		if strings.TrimSpace(message) != "" {
			return &verificationFailure{message: message}
		}
	}
	return errUnverified
}

type conditionCheck struct {
	Text     string          `json:"text"`
	Complies json.RawMessage `json:"complies"`
	Evidence []evidence      `json:"evidence"`
}

type agreementCheck struct {
	SourceID   string           `json:"sourceUuid"`
	Conditions []conditionCheck `json:"conditions"`
}

type verification struct {
	Action     documentCheck    `json:"action"`
	Expression documentCheck    `json:"expression"`
	Agreement  documentCheck    `json:"agreement"`
	Reviews    []agreementCheck `json:"reviews"`
}

type verificationInput struct {
	Context contextSnapshot `json:"context"`
	Draft   Draft           `json:"draft"`
}

func verificationPrompt(snapshot contextSnapshot, draft Draft) ([]Message, error) {
	encoded, err := json.Marshal(verificationInput{snapshot, draft})
	if err != nil {
		return nil, err
	}
	rules := verificationRulesFor(snapshot.Mode)
	if utf8.RuneCount(encoded)+utf8.RuneCountInString(rules) > constants.AIContextLimit {
		return nil, errUnverified
	}
	// 核验使用独立 system 消息，原始报告与草稿都只能作为数据进入 user 消息。
	return []Message{{Role: "system", Content: rules}, {Role: "user", Content: string(encoded)}}, nil
}

func verify(content string, snapshot contextSnapshot, draft Draft) (Draft, error) {
	var result verification
	decoder := json.NewDecoder(strings.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return Draft{}, errUnverified
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return Draft{}, errUnverified
	}
	// 非行动模式的 reviews 没有业务含义；模型省略空数组时按空数组处理。
	if snapshot.Mode != "action" && result.Reviews == nil {
		result.Reviews = []agreementCheck{}
	}
	if snapshot.Mode == "action" {
		normalizeUnusedCheck(&result.Expression)
	} else if snapshot.Mode == "expression" {
		normalizeUnusedCheck(&result.Action)
		normalizeUnusedCheck(&result.Agreement)
	} else if snapshot.Mode == "agreement" {
		normalizeUnusedCheck(&result.Action)
		normalizeUnusedCheck(&result.Expression)
	}
	if snapshot.Mode == "agreement" {
		if !validDocumentCheck(result.Action, snapshot, false, false) || !validDocumentCheck(result.Expression, snapshot, false, false) || !validDocumentCheck(result.Agreement, snapshot, false, false) || result.Reviews == nil || len(result.Reviews) != 0 || len(draft.Reviews) != 0 {
			return Draft{}, verificationFailureFor(result)
		}
		return draft, nil
	}
	if !validActionField(result.Action, snapshot) || !validExpressionDocument(result.Expression, snapshot, draft.Expression.Mode == "update") {
		return Draft{}, verificationFailureFor(result)
	}
	byID := map[string]agreementCheck{}
	for _, check := range result.Reviews {
		if _, exists := byID[check.SourceID]; !exists {
			byID[check.SourceID] = check
		}
	}
	reviews := make([]action.SourceAssessment, 0, len(snapshot.Sources))
	for _, source := range snapshot.Sources {
		check, exists := byID[source.NodeID]
		if !exists {
			reviews = append(reviews, action.SourceAssessment{SourceID: source.NodeID, Provided: true})
			continue
		}
		review, verifyErr := verifyAgreement(check, source.Agreement, snapshot)
		if verifyErr != nil {
			reviews = append(reviews, action.SourceAssessment{SourceID: source.NodeID, Provided: true})
			continue
		}
		reviews = append(reviews, review)
	}
	// 来源约定是提示信息，不阻止行动核验通过；最终以独立核验结果替换草稿中的初稿判断。
	for i, review := range reviews {
		if i < len(draft.Reviews) && !sameAssessment(review.Complies, draft.Reviews[i].Complies) {
			draft.Reply = "整体表达符合行动记录；来源约定核对已更新，仅作提示，请确认文稿。"
			break
		}
	}
	draft.Reviews = reviews
	return draft, nil
}

// normalizeUnusedCheck 把当前模式不使用的字段补成成功的空检查，避免模型省略可选字段导致整轮失败。
func normalizeUnusedCheck(check *documentCheck) {
	if check.Valid == nil {
		valid := true
		check.Valid = &valid
	}
	if check.Evidence == nil {
		check.Evidence = []evidence{}
	}
}

func validDocumentCheck(check documentCheck, snapshot contextSnapshot, required, expression bool) bool {
	if check.Valid == nil || !*check.Valid {
		return false
	}
	if !required {
		// 未使用字段允许省略空 evidence；与显式 [] 等价。
		return len(check.Evidence) == 0
	}
	if len(check.Evidence) == 0 {
		return false
	}
	for _, item := range check.Evidence {
		if !validEvidence(item, snapshot, expression, false) {
			return false
		}
	}
	return true
}

func validActionField(check documentCheck, snapshot contextSnapshot) bool {
	if snapshot.Mode == "action" {
		return check.Valid != nil && *check.Valid
	}
	return validDocumentCheck(check, snapshot, false, false)
}

func validExpressionDocument(check documentCheck, snapshot contextSnapshot, update bool) bool {
	if check.Valid == nil || !*check.Valid {
		return false
	}
	// 表达可以只包含主观兴趣/态度，因此 update 不强制至少一条证据；有事实锚点时仍逐条核验。
	if !update && len(check.Evidence) != 0 {
		return false
	}
	for _, item := range check.Evidence {
		if !validEvidence(item, snapshot, true, false) {
			return false
		}
	}
	return true
}

func validEvidence(item evidence, snapshot contextSnapshot, allowAction, ownAction bool) bool {
	if strings.TrimSpace(item.Quote) == "" {
		return false
	}
	if item.Kind == "report" && snapshot.Mode == "action" {
		for _, report := range snapshot.Reports {
			if item.ID == report.ID && strings.Contains(report.Text, item.Quote) {
				return true
			}
		}
	}
	if item.Kind == "action" && allowAction {
		for _, fact := range snapshot.Facts {
			if item.ID == fact.NodeID && (!ownAction || fact.ActorID == snapshot.ActorID) && (strings.Contains(fact.Objective, item.Quote) || strings.Contains(fact.Title, item.Quote)) {
				return true
			}
		}
	}
	return false
}

func verifyAgreement(check agreementCheck, agreement string, snapshot contextSnapshot) (action.SourceAssessment, error) {
	review := action.SourceAssessment{SourceID: check.SourceID, Provided: true}
	if check.Conditions == nil || (agreement == "" && len(check.Conditions) != 0) || (agreement != "" && len(check.Conditions) == 0) {
		return review, errUnverified
	}
	allTrue, failed := len(check.Conditions) > 0, []string{}
	var covered strings.Builder
	for _, condition := range check.Conditions {
		if strings.TrimSpace(condition.Text) == "" || !strings.Contains(agreement, condition.Text) || condition.Evidence == nil {
			return review, errUnverified
		}
		covered.WriteString(condition.Text)
		state := strings.TrimSpace(string(condition.Complies))
		if state != "true" && state != "false" && state != "null" {
			return review, errUnverified
		}
		for _, item := range condition.Evidence {
			if !validEvidence(item, snapshot, true, true) {
				return review, errUnverified
			}
		}
		if state == "null" && len(condition.Evidence) != 0 {
			return review, errUnverified
		}
		// 模型即使声称已满足，未提供可查原文也只能保留未知。
		if len(condition.Evidence) == 0 {
			state = "null"
		}
		allTrue = allTrue && state == "true"
		if state == "false" {
			failed = append(failed, condition.Text)
		}
	}
	if withoutSpace(covered.String()) != withoutSpace(agreement) {
		return review, errUnverified
	}
	if len(failed) > 0 {
		value := false
		review.Complies = &value
		reason := []rune("行动报告明确不符的约定条款：" + strings.Join(failed, "；"))
		if len(reason) > constants.ContextGuideLimit {
			reason = reason[:constants.ContextGuideLimit]
		}
		text := string(reason)
		review.ExceptionReason = &text
	} else if allTrue {
		value := true
		review.Complies = &value
	}
	return review, nil
}

func withoutSpace(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, text)
}

func sameAssessment(a, b *bool) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
