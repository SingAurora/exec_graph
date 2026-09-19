package identity

// User 是当前登录用户的应用层视图。
type User struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	UserID   string `json:"userId"`
	Email    string `json:"email"`
}

// SendCodeInput 是发送邮箱验证码用例的输入。
type SendCodeInput struct {
	Email       string
	Purpose     string
	CurrentUser *User
	ClientIP    string
}

// RegisterInput 是注册用例的输入。
type RegisterInput struct{ Username, Email, Password, Code string }

// LoginInput 是登录用例的输入。
type LoginInput struct{ Email, Password string }

// ChangeEmailInput 是修改邮箱用例的输入。
type ChangeEmailInput struct {
	User                                User
	Email, CurrentPassword, Code, Token string
}

// ChangePasswordInput 是修改密码用例的输入。
type ChangePasswordInput struct {
	User                                User
	CurrentPassword, NextPassword, Code string
}

// ResetPasswordInput 是重置密码用例的输入。
type ResetPasswordInput struct{ Email, NextPassword, Code string }
