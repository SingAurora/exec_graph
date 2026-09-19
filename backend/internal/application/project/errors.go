package project

import "errors"

var (
	ErrNotFound            = errors.New("project not found")
	ErrAlreadyArchived     = errors.New("project already archived")
	ErrNotArchived         = errors.New("project is not archived")
	ErrAdoptedContent      = errors.New("project has adopted content")
	ErrAIKeyUnavailable    = errors.New("AI key unavailable")
	ErrInvalidContract     = errors.New("invalid project contract")
	ErrInvalidProject      = errors.New("invalid project")
	ErrContractNotFound    = errors.New("contract not found")
	ErrContractInUse       = errors.New("contract is in use")
	ErrContractUnavailable = errors.New("smart contract unavailable")
	ErrCallUnavailable     = errors.New("contribution call unavailable")
)

// ValidationError 表示可以直接反馈给用户的项目规则错误。
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }
