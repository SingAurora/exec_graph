package media

import "github.com/singaurora/exec-graph/backend/internal/shared/fault"

// Limits 是账号上传次数及真实对象容量上限，由组合根注入。
type Limits struct {
	DailyRequests, MinuteRequests int64
	StorageBytes                  uint64
}

// Usage 只统计受管上传；失败及回收中的对象在确认删除前仍占容量。
type Usage struct {
	DailyRequests, MinuteRequests int64
	StorageBytes                  uint64
}

// Check 在账号锁内检查本次上传是否可登记，避免并发突破容量。
func (l Limits) Check(u Usage, size uint64) error {
	if u.DailyRequests >= l.DailyRequests {
		return fault.New(fault.TooMany, "今日图片上传次数已用完，请明天再试")
	}
	if u.MinuteRequests >= l.MinuteRequests {
		return fault.New(fault.TooMany, "图片上传过于频繁，请稍后再试")
	}
	if u.StorageBytes > l.StorageBytes || size > l.StorageBytes-u.StorageBytes {
		return fault.New(fault.TooMany, "图片存储额度不足，请等待未使用图片回收或联系平台")
	}
	return nil
}
