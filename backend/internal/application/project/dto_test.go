package project

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestProjectViewJSONUsesPublicUUIDNames(t *testing.T) {
	reviewKeyUUID := "550e8400-e29b-41d4-a716-446655440000"
	project := ProjectView{
		ID:                       "550e8400-e29b-41d4-a716-446655440001",
		ReviewAIKeyID:            &reviewKeyUUID,
		ActiveContractRevisionID: "550e8400-e29b-41d4-a716-446655440002",
	}

	encoded, err := json.Marshal(project)
	if err != nil {
		t.Fatalf("marshal project view: %v", err)
	}
	value := string(encoded)
	for _, forbidden := range []string{`"id":`, `"reviewAIKeyId":`, `"activeContractRevisionId":`} {
		if strings.Contains(value, forbidden) {
			t.Fatalf("project JSON leaked legacy identifier field %s: %s", forbidden, value)
		}
	}
	for _, required := range []string{`"uuid":`, `"reviewAIKeyUuid":`, `"activeContractRevisionUuid":`} {
		if !strings.Contains(value, required) {
			t.Fatalf("project JSON omitted UUID field %s: %s", required, value)
		}
	}
}
