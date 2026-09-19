package aikey

import "errors"

var (
	ErrNotFound = errors.New("AI key not found")
	ErrInUse    = errors.New("AI key is in use")
)
