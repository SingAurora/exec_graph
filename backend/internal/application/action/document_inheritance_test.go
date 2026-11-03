package action

import "testing"

func TestInheritedDocumentIDsUsePrimarySourceOnly(t *testing.T) {
	expression, agreement := inheritedDocumentIDs([]GenerationSource{
		{NodeID: "primary", ExpressionID: "expression-version", AgreementID: "agreement-version"},
		{NodeID: "merged", ExpressionID: "other-expression", AgreementID: "other-agreement"},
	})
	if expression != "expression-version" || agreement != "agreement-version" {
		t.Fatalf("没有只继承主要来源: %q %q", expression, agreement)
	}
	if expression, agreement := inheritedDocumentIDs(nil); expression != "" || agreement != "" {
		t.Fatalf("根节点不应继承文档: %q %q", expression, agreement)
	}
}
