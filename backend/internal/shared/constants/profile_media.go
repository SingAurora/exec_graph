package constants

const (
	// AvatarUploadBytes 是头像原始文件大小上限。
	AvatarUploadBytes = 2 * 1024 * 1024
	// AvatarRequestBodyBytes 是包含 multipart 开销的头像请求体上限。
	AvatarRequestBodyBytes = AvatarUploadBytes + 128*1024
	// ProfileBackgroundUploadBytes 是主页背景原始文件大小上限。
	ProfileBackgroundUploadBytes = 2 * 1024 * 1024
	// ProfileBackgroundRequestBodyBytes 是包含 multipart 开销的背景图请求体上限。
	ProfileBackgroundRequestBodyBytes = ProfileBackgroundUploadBytes + 128*1024
)
