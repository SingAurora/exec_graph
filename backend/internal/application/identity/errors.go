package identity

import "errors"

var (
	ErrUnauthenticated     = errors.New("unauthenticated")
	ErrInvalidEmail        = errors.New("invalid email")
	ErrInvalidPurpose      = errors.New("invalid verification purpose")
	ErrEmailUnchanged      = errors.New("email unchanged")
	ErrEmailRegistered     = errors.New("email already registered")
	ErrEmailNotFound       = errors.New("email not found")
	ErrInvalidCode         = errors.New("invalid verification code")
	ErrInvalidUsername     = errors.New("invalid username")
	ErrInvalidPassword     = errors.New("invalid password")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrCurrentPassword     = errors.New("current password incorrect")
	ErrMissingSessionToken = errors.New("missing session token")
)
