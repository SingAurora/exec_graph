package identity

import (
	"regexp"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// DefaultSmartContractID 是新用户初始项目采用的平台默认行动规则。
const DefaultSmartContractID = sharedconstants.QuickActionSmartContractID

const (
	PurposeRegister       = "register"
	PurposeChangeEmail    = "change_email"
	PurposeChangePassword = "change_password"
	PurposeResetPassword  = "reset_password"
)

var verificationCodePattern = regexp.MustCompile(`^\d{6}$`)
var userIDPattern = regexp.MustCompile(`^[A-Za-z0-9_]{2,24}$`)
