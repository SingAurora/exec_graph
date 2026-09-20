// Package request 提供 HTTP 请求解析与请求级校验，不依赖 endpoint 或业务逻辑。
package request

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const MaxJSONRequestBytes = 1 << 20

var (
	ErrJSONBodyTooLarge = errors.New("JSON request body exceeds the size limit")
	ErrInvalidJSONBody  = errors.New("invalid JSON request body")
)

// DecodeJSON 在统一的请求体大小限制内，将一份 JSON 请求体解析到 target。
func DecodeJSON(r *http.Request, target any) error {
	contents, err := readJSONBody(r)
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

func readJSONBody(r *http.Request) ([]byte, error) {
	contents, err := io.ReadAll(io.LimitReader(r.Body, MaxJSONRequestBytes+1))
	if err != nil {
		return nil, err
	}
	if len(contents) > MaxJSONRequestBytes {
		return nil, ErrJSONBodyTooLarge
	}
	return contents, nil
}
