package identity

// User 是当前登录用户的应用层视图。
type User struct {
	// ID 仅供服务端鉴权、权限判断和数据库操作使用，不属于公开用户视图。
	ID       uint64 `json:"-"`
	Username string `json:"username"`
	UserID   string `json:"userId"`
	Email    string `json:"email"`
}

// Profile 是个人资料用例返回的视图，不包含密码和验证码等敏感字段。
type Profile struct {
	// ID 仅供服务端读取资料后的内部处理使用，不应进入 HTTP 响应。
	ID                    uint64
	Username              string
	UserID                string
	Email                 string
	Bio                   string
	Gender                string
	AvatarObjectKey       string
	ProfileBackgroundKey  string
	AvatarURL             *string
	ProfileBackgroundURL  *string
	CustomProfileEnabled  bool
	CustomProfileMarkdown string
}

// ProfileMediaResult 是上传并保存个人资料媒体后的访问结果。
type ProfileMediaResult struct {
	URL string
}

// UpdateProfileInput 是更新个人资料用例的输入。
type UpdateProfileInput struct {
	Username              string
	UserID                string
	Bio                   string
	Gender                string
	CustomProfileEnabled  bool
	CustomProfileMarkdown string
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
