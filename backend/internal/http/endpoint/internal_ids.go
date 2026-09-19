package endpoint

import (
	"context"
	"database/sql"
	"fmt"
)

// idLookup is deliberately limited to tables that expose a UUID. It keeps
// public UUIDs at the HTTP boundary and prevents them from leaking into
// internal relationship columns.
type idLookup interface {
	Row(context.Context, string, ...any) *sql.Row
}

var uuidEntityTables = map[string]string{
	"ai_api_keys":                "ai_api_keys",
	"collaboration_calls":        "collaboration_calls",
	"collaboration_submissions":  "collaboration_submissions",
	"completion_records":         "completion_records",
	"execution_branches":         "execution_branches",
	"execution_contracts":        "execution_contracts",
	"node_conversations":         "node_conversations",
	"project_contract_revisions": "project_contract_revisions",
	"projects":                   "projects",
	"smart_contracts":            "smart_contracts",
}

func internalID(ctx context.Context, db idLookup, entity, uuid string) (uint64, error) {
	table, ok := uuidEntityTables[entity]
	if !ok {
		return 0, fmt.Errorf("unsupported UUID entity %q", entity)
	}
	var id uint64
	if err := db.Row(ctx, "SELECT id FROM "+table+" WHERE uuid = ?", uuid).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

func publicUUID(ctx context.Context, db idLookup, entity string, id uint64) (string, error) {
	table, ok := uuidEntityTables[entity]
	if !ok {
		return "", fmt.Errorf("unsupported UUID entity %q", entity)
	}
	var uuid string
	if err := db.Row(ctx, "SELECT uuid FROM "+table+" WHERE id = ?", id).Scan(&uuid); err != nil {
		return "", err
	}
	return uuid, nil
}

func nullablePublicUUID(ctx context.Context, db idLookup, entity string, id sql.NullInt64) (*string, error) {
	if !id.Valid {
		return nil, nil
	}
	uuid, err := publicUUID(ctx, db, entity, uint64(id.Int64))
	if err != nil {
		return nil, err
	}
	return &uuid, nil
}

func optionalInternalID(ctx context.Context, db idLookup, entity, uuid string) (any, error) {
	if uuid == "" {
		return nil, nil
	}
	id, err := internalID(ctx, db, entity, uuid)
	if err != nil {
		return nil, err
	}
	return id, nil
}
