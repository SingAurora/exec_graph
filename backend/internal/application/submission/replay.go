// Package submission 实现创建命令的事务内幂等重放。
package submission

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Receipt 是账号和操作隔离的已确认结果，不包含 HTTP 外壳。
type Receipt struct {
	Digest   []byte
	Response json.RawMessage
}

// Log 必须绑定当前事务；调用前已锁定提交账号。
type Log interface {
	Receipt(command, key string) (*Receipt, error)
	Record(command, key string, receipt Receipt, expires time.Time) error
}

// Run 在同一事务中重放旧结果或执行并保存新结果。
func Run[T any](log Log, command, key string, input any, execute func() (T, error)) (T, error) {
	var zero T
	if !id.Valid(key) {
		return zero, fault.New(fault.Invalid, "请提供 UUID 格式的 Idempotency-Key")
	}
	encoded, err := json.Marshal(input)
	if err != nil {
		return zero, err
	}
	digest := sha256.Sum256(encoded)
	previous, err := log.Receipt(command, key)
	if err != nil {
		return zero, err
	}
	if previous != nil {
		if !bytes.Equal(previous.Digest, digest[:]) {
			return zero, fault.New(fault.Conflict, "同一提交标识不能用于不同内容")
		}
		var result T
		if err := json.Unmarshal(previous.Response, &result); err != nil {
			return zero, err
		}
		return result, nil
	}
	result, err := execute()
	if err != nil {
		return zero, err
	}
	body, err := json.Marshal(result)
	if err != nil {
		return zero, err
	}
	err = log.Record(command, key, Receipt{Digest: digest[:], Response: body}, time.Now().UTC().Add(constants.IdempotencyRetention))
	return result, err
}
