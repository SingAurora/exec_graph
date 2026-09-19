package common

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// DecodeJSON 统一解析 endpoint 层 JSON 请求体，并把解析失败转成业务错误。
func DecodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}

// BindJSON 是旧式 handler 的兼容入口。新代码优先返回 error 给顶层错误边界。
func BindJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := DecodeJSON(r, target); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}

func WriteJSON(w http.ResponseWriter, status int, value any) {
	httpresponse.WriteJSON(w, status, value)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	httpresponse.WriteError(w, status, message)
}

func WriteFault(w http.ResponseWriter, err error) {
	httpresponse.WriteFault(w, err)
}

func BearerToken(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(value) < len("Bearer ") || !strings.EqualFold(value[:len("Bearer ")], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(value[len("Bearer "):])
}

func ClientIP(r *http.Request) string {
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return address
}

func NewOpaqueID(_ string) (string, error) { return sharedid.UUID() }

func JSONValue(value any) (string, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func NullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func DecodeOptionalJSON(value sql.NullString) any {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil
	}
	return DecodeJSONValue(value.String, nil)
}

func DecodeJSONValue(value string, fallback any) any {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded any
	if err := json.Unmarshal([]byte(value), &decoded); err != nil {
		return fallback
	}
	return decoded
}

func UniqueNonEmpty(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

type IDLookup interface {
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

func InternalID(ctx context.Context, db IDLookup, entity, uuid string) (uint64, error) {
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

func PublicUUID(ctx context.Context, db IDLookup, entity string, id uint64) (string, error) {
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

func NullablePublicUUID(ctx context.Context, db IDLookup, entity string, id sql.NullInt64) (*string, error) {
	if !id.Valid {
		return nil, nil
	}
	uuid, err := PublicUUID(ctx, db, entity, uint64(id.Int64))
	if err != nil {
		return nil, err
	}
	return &uuid, nil
}

func OptionalInternalID(ctx context.Context, db IDLookup, entity, uuid string) (any, error) {
	if uuid == "" {
		return nil, nil
	}
	id, err := InternalID(ctx, db, entity, uuid)
	if err != nil {
		return nil, err
	}
	return id, nil
}
