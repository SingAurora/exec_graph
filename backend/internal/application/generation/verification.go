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
	Evidence []evidence `json:"evidence"`
}

type conditionCheck struct {
	Text     string          `json:"text"`
	Complies json.RawMessage `json:"complies"`
	Evidence []evidence      `json:"evidence"`
}

type agreementCheck struct {
	SourceID   string           `json:"sourceId"`
	Conditions []conditionCheck `json:"conditions"`
}

type verification struct {
	Action     documentCheck    `json:"action"`
	Expression documentCheck    `json:"expression"`
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
	if utf8.RuneCount(encoded)+utf8.RuneCountInString(verificationRules) > constants.AIContextLimit {
		return nil, errUnverified
	}
	// 核验使用独立 system 消息，原始报告与草稿都只能作为数据进入 user 消息。
	return []Message{{Role: "system", Content: verificationRules}, {Role: "user", Content: string(encoded)}}, nil
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
	if !validDocumentCheck(result.Action, snapshot, snapshot.Mode == "action", false) || !validDocumentCheck(result.Expression, snapshot, draft.Expression.Mode == "update", true) || result.Reviews == nil || len(result.Reviews) != len(snapshot.Sources) || len(draft.Reviews) != len(snapshot.Sources) {
		return Draft{}, errUnverified
	}
	byID := map[string]agreementCheck{}
	for _, check := range result.Reviews {
		if _, exists := byID[check.SourceID]; exists {
			return Draft{}, errUnverified
		}
		byID[check.SourceID] = check
	}
	reviews := make([]action.SourceAssessment, 0, len(snapshot.Sources))
	for _, source := range snapshot.Sources {
		check, exists := byID[source.NodeID]
		if !exists {
			return Draft{}, errUnverified
		}
		review, err := verifyAgreement(check, source.Agreement, snapshot)
		if err != nil {
			return Draft{}, err
		}
		reviews = append(reviews, review)
	}
	// 最终核对以独立逐项结果为准，不沿用生成器可能过早给出的“满足”。
	for i, review := range reviews {
		if !sameAssessment(review.Complies, draft.Reviews[i].Complies) {
			draft.Reply = "已整理行动记录；约定核对已按字面依据更新，请确认文稿和核对结果。"
		}
	}
	draft.Reviews = reviews
	return draft, nil
}

func validDocumentCheck(check documentCheck, snapshot contextSnapshot, required, expression bool) bool {
	if check.Valid == nil || !*check.Valid || check.Evidence == nil {
		return false
	}
	if !required {
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
