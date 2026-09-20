package common

import (
	"database/sql"
	"encoding/json"
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
