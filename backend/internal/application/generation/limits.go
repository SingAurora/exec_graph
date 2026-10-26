package generation

import "github.com/singaurora/exec-graph/backend/internal/shared/fault"

// Limits 是组合根注入的账号生成限额，不涉及模型凭据或 HTTP。
type Limits struct {
	DailyRequests, MinuteRequests, ConcurrentRequests int64
}

// Usage 包含已受理尝试和未超时的在途生成；失败尝试不返还次数。
type Usage struct {
	DailyRequests, MinuteRequests, PendingRequests int64
}

// Check 在账号锁内登记新生成之前调用；幂等重放不经过此检查。
func (l Limits) Check(u Usage) error {
	if u.DailyRequests >= l.DailyRequests {
		return fault.New(fault.TooMany, "今日 AI 生成次数已用完，请明天再试")
	}
	if u.MinuteRequests >= l.MinuteRequests {
		return fault.New(fault.TooMany, "AI 生成过于频繁，请稍后再试")
	}
	if u.PendingRequests >= l.ConcurrentRequests {
		return fault.New(fault.TooMany, "正在进行的 AI 生成较多，请等待完成后再试")
	}
	return nil
}
