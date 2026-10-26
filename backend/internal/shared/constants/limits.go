package constants

import "time"

const (
	// UsageWindow 是账号请求频率的滚动统计窗口。
	UsageWindow = time.Minute
	// DefaultAIDailyRequests 限制单账号每天受理的模型请求数。
	DefaultAIDailyRequests = 100
	// DefaultAIMinuteRequests 限制单账号滚动一分钟受理的模型请求数。
	DefaultAIMinuteRequests = 10
	// DefaultAIConcurrentRequests 限制单账号未超时的在途生成数。
	DefaultAIConcurrentRequests = 2
	// DefaultUploadDailyRequests 限制单账号每天受理的上传数。
	DefaultUploadDailyRequests = 100
	// DefaultUploadMinuteRequests 限制单账号滚动一分钟受理的上传数。
	DefaultUploadMinuteRequests = 20
	// DefaultMediaStorageBytes 限制单账号尚未确认删除的真实上传容量。
	DefaultMediaStorageBytes = 512 << 20
)
