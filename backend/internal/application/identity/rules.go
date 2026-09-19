package identity

import "regexp"

const GeneralSmartContractID = "smart-contract-general"

const (
	PurposeRegister       = "register"
	PurposeChangeEmail    = "change_email"
	PurposeChangePassword = "change_password"
	PurposeResetPassword  = "reset_password"
)

var verificationCodePattern = regexp.MustCompile(`^\d{6}$`)
var userIDPattern = regexp.MustCompile(`^[A-Za-z0-9_]{2,24}$`)
