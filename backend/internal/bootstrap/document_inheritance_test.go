package bootstrap

import (
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestContinuationInheritsPublishedDocuments(t *testing.T) {
	s := writeFixture(t)
	jo := s.as(t, id.Demo("user", "jo"))

	var source model.ActionNode
	var sourceExpression model.DocumentState
	mustDB(t, s.deps.DB.Where("is_root = 0").Order("id").Take(&source))
	mustDB(t, s.deps.DB.Where("node_uuid = ? AND kind = ?", source.UUID, "expression").Take(&sourceExpression))
	if sourceExpression.EffectiveVersionUUID == nil {
		t.Fatal("演示来源没有可继承的表达")
	}
	var sourceAgreement model.DocumentState
	mustDB(t, s.deps.DB.Where("node_uuid = ? AND kind = ?", source.UUID, "agreement").Take(&sourceAgreement))
	if sourceAgreement.EffectiveVersionUUID == nil {
		t.Fatal("演示来源没有可继承的约定")
	}

	input := s.draft(t, id.Demo("user", "jo"), source.GraphUUID, "", []string{source.UUID}, action.DocumentUpdate{Mode: "inherit"}, action.DocumentUpdate{Mode: "inherit"})
	published := jo.publish(t, input)
	if published.ExpressionStatus != "published" || published.AgreementStatus != "published" || !published.NodeReady {
		t.Fatalf("继承文档没有直接变为已发布: %+v", published)
	}
	if published.ExpressionMarkdown == nil || *published.ExpressionMarkdown == "" {
		t.Fatal("继承的表达没有出现在公开行动视图")
	}

	var expressionState model.DocumentState
	mustDB(t, s.deps.DB.Where("node_uuid = ? AND kind = ?", published.ID, "expression").Take(&expressionState))
	if expressionState.Mode != "inherit" || expressionState.LocalVersionUUID != nil ||
		expressionState.EffectiveVersionUUID == nil || *expressionState.EffectiveVersionUUID != *sourceExpression.EffectiveVersionUUID {
		t.Fatalf("表达没有继承主要来源版本: %+v", expressionState)
	}
	var agreementState model.DocumentState
	mustDB(t, s.deps.DB.Where("node_uuid = ? AND kind = ?", published.ID, "agreement").Take(&agreementState))
	if agreementState.Mode != "inherit" || agreementState.LocalVersionUUID != nil ||
		agreementState.EffectiveVersionUUID == nil || *agreementState.EffectiveVersionUUID != *sourceAgreement.EffectiveVersionUUID {
		t.Fatalf("约定没有继承主要来源版本: %+v", agreementState)
	}
}
