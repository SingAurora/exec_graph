package id_test

import (
	"testing"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestUser(t *testing.T) {
	userID, err := sharedid.User()
	if err != nil {
		t.Fatalf("User(): %v", err)
	}
	if _, err := applicationidentity.NormalizeUserID(userID); err != nil {
		t.Fatalf("User() = %q, which does not match the user ID rules", userID)
	}
}
