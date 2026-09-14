package app

import sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"

func newOpaqueID(prefix string) (string, error) { return sharedid.Opaque(prefix) }

func newUserID() (string, error) { return sharedid.User() }

func newSessionToken() (string, error) { return sharedid.SessionToken() }
