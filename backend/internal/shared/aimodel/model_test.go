package aimodel

import "testing"

func TestResponseModel(t *testing.T) {
	stored := "draft=deepseek-v4-pro;analysis=deepseek-v4-pro"
	for _, test := range []struct {
		name, mode, stored, want string
	}{
		{"action uses draft model", "action", stored, "deepseek-v4-pro"},
		{"expression uses analysis model", "expression", stored, "deepseek-v4-pro"},
		{"agreement uses analysis model", "agreement", stored, "deepseek-v4-pro"},
		{"different models stay distinct", "expression", "draft=draft-model;analysis=analysis-model", "analysis-model"},
		{"whitespace is trimmed", "action", " draft = draft-model ; analysis = analysis-model ", "draft-model"},
		{"unknown fixture is empty", "action", "integration-fixture", ""},
		{"empty record is empty", "action", "", ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := ResponseModel(test.mode, test.stored); got != test.want {
				t.Fatalf("ResponseModel(%q, %q) = %q, want %q", test.mode, test.stored, got, test.want)
			}
		})
	}
}
