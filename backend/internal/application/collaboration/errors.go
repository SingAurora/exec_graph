package collaboration

import "errors"

var (
	ErrNotFound            = errors.New("collaboration resource not found")
	ErrInvalidRequest      = errors.New("invalid collaboration request")
	ErrProjectPrivate      = errors.New("project is private")
	ErrTargetNotReady      = errors.New("target is not ready")
	ErrCallExists          = errors.New("open call already exists")
	ErrSubmissionInvalid   = errors.New("invalid submission")
	ErrDuplicateSubmission = errors.New("duplicate submission")
	ErrUnauthorized        = errors.New("collaboration operation is not authorized")
)
