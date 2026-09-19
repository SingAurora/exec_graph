package endpoint

import sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"

func newOpaqueID(_ string) (string, error) { return sharedid.UUID() }

func newUserID() (string, error) { return sharedid.User() }

func newSessionToken() (string, error) { return sharedid.SessionToken() }
