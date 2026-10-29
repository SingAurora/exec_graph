package generation

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
)

func boolPointer(value bool) *bool { return &value }

func verificationFixture() (contextSnapshot, Draft, verification) {
	currentReport := report{"current-report", "我今天骑了30公里，用时2小时。"}
	proof := evidence{"report", currentReport.ID, currentReport.Text}
	snapshot := contextSnapshot{Mode: "action", ActorID: "me", Reports: []report{currentReport}, Sources: []source{{NodeID: "source", Agreement: "记录距离。记录用时。"}}, Facts: []fact{{NodeID: "mine", ActorID: "me", Objective: "上周骑了6公里。"}, {NodeID: "other", ActorID: "someone", Objective: "骑了30公里。"}}}
	draft := Draft{Reply: "已满足约定", Title: "骑了30公里", Objective: currentReport.Text, Expression: action.DocumentUpdate{Mode: "clear"}, Reviews: []action.SourceAssessment{{SourceID: "source", Complies: boolPointer(true), Provided: true}}}
	result := verification{Action: documentCheck{boolPointer(true), []evidence{proof}}, Expression: documentCheck{boolPointer(true), []evidence{}}, Reviews: []agreementCheck{{SourceID: "source", Conditions: []conditionCheck{
		{Text: "记录距离。", Complies: json.RawMessage("true"), Evidence: []evidence{{"report", currentReport.ID, "骑了30公里"}}},
		{Text: "记录用时。", Complies: json.RawMessage("true"), Evidence: []evidence{{"report", currentReport.ID, "用时2小时"}}},
	}}}}
	return snapshot, draft, result
}

func TestVerificationRecomputesLiteralAgreementFromEvidence(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*contextSnapshot, *verification)
		want   *bool
	}{
		{"all conditions supported", func(*contextSnapshot, *verification) {}, boolPointer(true)},
		{"missing time stays unknown", func(s *contextSnapshot, v *verification) {
			s.Reports[0].Text = "我今天骑了30公里。"
			v.Action.Evidence[0].Quote = s.Reports[0].Text
			v.Reviews[0].Conditions[1].Complies = json.RawMessage("null")
			v.Reviews[0].Conditions[1].Evidence = []evidence{}
		}, nil},
		{"unsupported true becomes unknown", func(_ *contextSnapshot, v *verification) {
			v.Reviews[0].Conditions[1].Evidence = []evidence{}
		}, nil},
		{"unsupported false becomes unknown", func(_ *contextSnapshot, v *verification) {
			v.Reviews[0].Conditions[1].Complies = json.RawMessage("false")
			v.Reviews[0].Conditions[1].Evidence = []evidence{}
		}, nil},
		{"explicit contradiction stays false", func(s *contextSnapshot, v *verification) {
			s.Reports[0].Text = "我今天骑了30公里，没有记录用时。"
			v.Action.Evidence[0].Quote = s.Reports[0].Text
			v.Reviews[0].Conditions[1].Complies = json.RawMessage("false")
			v.Reviews[0].Conditions[1].Evidence[0].Quote = "没有记录用时"
		}, boolPointer(false)},
	} {
		t.Run(test.name, func(t *testing.T) {
			snapshot, draft, result := verificationFixture()
			test.change(&snapshot, &result)
			body, err := json.Marshal(result)
			if err != nil {
				t.Fatal(err)
			}
			checked, err := verify(string(body), snapshot, draft)
			if err != nil || !sameAssessment(checked.Reviews[0].Complies, test.want) {
				t.Fatalf("逐项结果错误: %+v %v", checked, err)
			}
			if test.want != nil && !*test.want && (checked.Reviews[0].ExceptionReason == nil || !strings.Contains(*checked.Reviews[0].ExceptionReason, "记录用时")) {
				t.Fatal("明确不符没有保留对应约定条款")
			}
			if test.want == nil && checked.Reviews[0].ExceptionReason != nil {
				t.Fatal("未知被附加不符理由")
			}
			if !sameAssessment(test.want, draft.Reviews[0].Complies) && strings.Contains(checked.Reply, "已满足约定") {
				t.Fatal("更正核对后仍宣称满足")
			}
		})
	}
}

func TestVerificationRejectsMissingOrInventedEvidence(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*contextSnapshot, *Draft, *verification)
	}{
		{"action contains opinion", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Valid = boolPointer(false) }},
		{"expression unsupported", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Expression.Valid = boolPointer(false) }},
		{"missing verdict", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Valid = nil }},
		{"no action evidence", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Evidence = []evidence{} }},
		{"AI draft is not evidence", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Evidence[0].Kind = "draft" }},
		{"old action is not current action", func(_ *contextSnapshot, _ *Draft, v *verification) {
			v.Action.Evidence[0] = evidence{"action", "mine", "上周骑了6公里。"}
		}},
		{"invented report", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Evidence[0].ID = "other-report" }},
		{"invented quote", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Action.Evidence[0].Quote = "坚持了十年" }},
		{"omitted clause", func(_ *contextSnapshot, _ *Draft, v *verification) {
			v.Reviews[0].Conditions = v.Reviews[0].Conditions[:1]
		}},
		{"omitted complies", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Reviews[0].Conditions[0].Complies = nil }},
		{"duplicate source", func(s *contextSnapshot, d *Draft, v *verification) {
			s.Sources = append(s.Sources, source{NodeID: "second", Agreement: "记录距离。"})
			d.Reviews = append(d.Reviews, action.SourceAssessment{SourceID: "second"})
			v.Reviews = append(v.Reviews, v.Reviews[0])
		}},
		{"unknown source", func(_ *contextSnapshot, _ *Draft, v *verification) { v.Reviews[0].SourceID = "unrelated" }},
		{"changed agreement", func(_ *contextSnapshot, _ *Draft, v *verification) {
			v.Reviews[0].Conditions[0].Text = "骑行即可。"
		}},
		{"other person cannot satisfy agreement", func(_ *contextSnapshot, _ *Draft, v *verification) {
			v.Reviews[0].Conditions[0].Evidence[0] = evidence{"action", "other", "骑了30公里。"}
		}},
		{"chat cannot extend published expression facts", func(s *contextSnapshot, d *Draft, v *verification) {
			s.Mode, s.Sources = "expression", []source{}
			d.Expression = action.DocumentUpdate{Mode: "update", Markdown: &d.Objective}
			d.Reviews = []action.SourceAssessment{}
			v.Expression.Evidence = v.Action.Evidence
			v.Action.Evidence, v.Reviews = []evidence{}, []agreementCheck{}
		}},
		{"unrelated action cannot support expression", func(_ *contextSnapshot, d *Draft, v *verification) {
			d.Expression = action.DocumentUpdate{Mode: "update", Markdown: &d.Objective}
			v.Expression.Evidence = []evidence{{"action", "unrelated", "骑行。"}}
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			snapshot, draft, result := verificationFixture()
			test.change(&snapshot, &draft, &result)
			body, err := json.Marshal(result)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := verify(string(body), snapshot, draft); !errors.Is(err, errUnverified) {
				t.Fatalf("无效核验被接受: %v", err)
			}
		})
	}
}

func TestExpressionVerificationUsesPublishedActionsOnly(t *testing.T) {
	snapshot, draft, result := verificationFixture()
	snapshot.Mode, snapshot.Sources = "expression", []source{}
	draft.Expression, draft.Reviews = action.DocumentUpdate{Mode: "update", Markdown: &draft.Objective}, []action.SourceAssessment{}
	result.Action.Evidence, result.Reviews = []evidence{}, []agreementCheck{}
	result.Expression.Evidence = []evidence{{"action", "mine", "上周骑了6公里。"}}
	body, _ := json.Marshal(result)
	if _, err := verify(string(body), snapshot, draft); err != nil {
		t.Fatal(err)
	}
	snapshot.Facts[0].Title = "从厦门骑到漳州"
	result.Expression.Evidence[0].Quote = snapshot.Facts[0].Title
	titleProof, _ := json.Marshal(result)
	if _, err := verify(string(titleProof), snapshot, draft); err != nil {
		t.Fatalf("已发布行动标题中的事实不能作为依据: %v", err)
	}
	for _, body := range []string{string(body) + `{}`, strings.Replace(string(body), `"action":`, `"bypass":true,"action":`, 1), `{}`} {
		if _, err := verify(body, snapshot, draft); !errors.Is(err, errUnverified) {
			t.Fatalf("损坏核验被接受: %v", err)
		}
	}
}

func TestSnapshotSeparatesCurrentUsersReportsFromOtherSpeakers(t *testing.T) {
	p := Pending{ActorID: "me", Mode: "action", InputMessage: "今天骑了六公里。", Conversation: Conversation{Messages: []Message{
		{Role: "user", AuthorID: "other", Content: "别人骑了三十公里"},
		{Role: "assistant", Content: "AI 自己加的经历"},
		{Role: "user", AuthorID: "me", Content: "我戴了头盔"},
		{Role: "user", Content: "归属不明的旧报告"},
	}}}
	snapshot := snapshotFor(action.Graph{}, nil, []catalogue.ActionView{}, p, false)
	if len(snapshot.Reports) != 2 || snapshot.Reports[0].Text != "我戴了头盔" || snapshot.Reports[1].ID != "current-report" {
		t.Fatalf("报告归属不正确: %+v", snapshot.Reports)
	}
	messages, err := verificationPrompt(snapshot, Draft{})
	if err != nil || len(messages) != 2 || messages[1].Role != "user" {
		t.Fatalf("核验上下文没有作为数据传入: %+v %v", messages, err)
	}
	if strings.Contains(messages[0].Content, p.InputMessage) {
		t.Fatal("用户报告进入了核验系统指令")
	}
}
