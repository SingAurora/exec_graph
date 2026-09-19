// Package request 提供 HTTP 请求解析与请求级校验，不依赖 endpoint 或业务逻辑。
package request

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

const MaxJSONRequestBytes = 1 << 20

var (
	ErrJSONBodyTooLarge = errors.New("JSON request body exceeds the size limit")
	ErrInvalidJSONBody  = errors.New("invalid JSON request body")
)

// DecodeJSON 在统一的请求体大小限制内，将一份 JSON 请求体解析到 target。
func DecodeJSON(r *http.Request, target any) error {
	contents, err := readJSONBody(r, false)
	if err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(contents))
	if err := decoder.Decode(target); err != nil {
		return ErrInvalidJSONBody
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return ErrInvalidJSONBody
	}
	return nil
}

// String returns a named input value. GET inputs come from query parameters;
// POST inputs come from the top-level JSON object. The body is restored so a
// following endpoint bind can decode the complete request once more.
func String(r *http.Request, key string) (string, error) {
	if value := strings.TrimSpace(r.URL.Query().Get(key)); value != "" {
		return value, nil
	}
	contents, err := readJSONBody(r, true)
	if err != nil || len(contents) == 0 {
		return "", err
	}
	values := map[string]json.RawMessage{}
	if err := json.Unmarshal(contents, &values); err != nil {
		return "", ErrInvalidJSONBody
	}
	var value string
	if err := json.Unmarshal(values[key], &value); err != nil {
		return "", nil
	}
	return strings.TrimSpace(value), nil
}

func readJSONBody(r *http.Request, restore bool) ([]byte, error) {
	contents, err := io.ReadAll(io.LimitReader(r.Body, MaxJSONRequestBytes+1))
	if err != nil {
		return nil, err
	}
	if restore {
		r.Body = io.NopCloser(bytes.NewReader(contents))
	}
	if len(contents) > MaxJSONRequestBytes {
		return nil, ErrJSONBodyTooLarge
	}
	return contents, nil
}
