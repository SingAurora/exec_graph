package action

import "testing"

func TestDocumentInheritanceTargetsAreIndependent(t *testing.T) {
	cases := []struct {
		name, expression, agreement   string
		wantExpression, wantAgreement string
	}{
		{"both", "expr", "agreement", "expr", "agreement"},
		{"expression only", "expr", "", "expr", ""},
		{"agreement only", "", "agreement", "", "agreement"},
		{"neither", "", "", "", ""},
	}
	for _, test := range cases {
		targets := documentInheritanceTargets(test.expression, test.agreement)
		if len(targets) != 2 || targets[0].kind != "expression" || targets[1].kind != "agreement" {
			t.Fatalf("%s: unexpected targets %+v", test.name, targets)
		}
		if targets[0].versionID != test.wantExpression || targets[1].versionID != test.wantAgreement {
			t.Fatalf("%s: expression or agreement was coupled: %+v", test.name, targets)
		}
	}
}
