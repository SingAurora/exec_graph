package workoverview

import (
	"context"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

const (
	// ActionWindowToday 表示从今天零点到当前时刻的行动记录。
	ActionWindowToday = "today"
	// ActionWindowSevenDays 表示包含今天在内的近七个自然日。
	ActionWindowSevenDays = "7d"
	// ActionWindowThirtyDays 表示包含今天在内的近三十个自然日。
	ActionWindowThirtyDays = "30d"
)

type actionStateRange struct {
	window        string
	start         time.Time
	end           time.Time
	previousStart time.Time
	previousEnd   time.Time
	windowDays    int
	partial       bool
}

// GetActionState 按时间窗口聚合当前用户已经记录的行动事实。
// 该用例不推断计划完成率，不给用户评分，也不调用 AI。
func (s *Service) GetActionState(ctx context.Context, userID uint64, window string, now time.Time) (ActionState, error) {
	period, err := resolveActionStateRange(window, now)
	if err != nil {
		return ActionState{}, err
	}

	ctx, cancel := context.WithTimeout(ctx, sharedconstants.WorkOverviewTimeout)
	defer cancel()
	current, err := s.ListDailyActivity(ctx, userID, period.start, period.end)
	if err != nil {
		return ActionState{}, err
	}
	previous, err := s.ListDailyActivity(ctx, userID, period.previousStart, period.previousEnd)
	if err != nil {
		return ActionState{}, err
	}

	return buildActionState(period, current, previous), nil
}

func resolveActionStateRange(window string, now time.Time) (actionStateRange, error) {
	now = now.In(time.Local)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	period := actionStateRange{window: window, end: now, partial: true}

	switch window {
	case ActionWindowToday:
		period.start = today
		period.previousStart = today.AddDate(0, 0, -1)
		period.previousEnd = today
		period.windowDays = 1
	case ActionWindowSevenDays:
		period.start = today.AddDate(0, 0, -6)
		period.previousStart = period.start.AddDate(0, 0, -7)
		period.previousEnd = period.start
		period.windowDays = 7
	case ActionWindowThirtyDays:
		period.start = today.AddDate(0, 0, -29)
		period.previousStart = period.start.AddDate(0, 0, -30)
		period.previousEnd = period.start
		period.windowDays = 30
	default:
		return actionStateRange{}, fault.New(fault.InvalidRequest, "行动状态窗口只能是 today、7d 或 30d")
	}
	return period, nil
}

func buildActionState(period actionStateRange, current, previous []Day) ActionState {
	currentFacts, currentActiveDays, currentReviewedDays, recent := summarizeDays(current)
	previousFacts, previousActiveDays, _, _ := summarizeDays(previous)
	return ActionState{
		Window: period.window,
		Range:  ActionStateRange{Start: period.start, End: period.end, Timezone: time.Local.String(), Partial: period.partial},
		Coverage: ActionStateCoverage{
			WindowDays: period.windowDays, ActiveDays: currentActiveDays, ReviewedDays: currentReviewedDays,
			Confidence: actionStateConfidence(period.windowDays, currentFacts.Activities, currentActiveDays),
		},
		Facts: currentFacts,
		Comparison: ActionStateComparison{
			PreviousActivities: previousFacts.Activities,
			PreviousActiveDays: previousActiveDays,
			ActivityChange:     currentFacts.Activities - previousFacts.Activities,
			ActiveDaysChange:   currentActiveDays - previousActiveDays,
			Conclusion:         actionStateComparisonConclusion(currentFacts.Activities, previousFacts.Activities, currentActiveDays, previousActiveDays),
		},
		RecentActivities: recent,
	}
}

func summarizeDays(days []Day) (ActionStateFacts, int, int, []Activity) {
	var facts ActionStateFacts
	activeDays := 0
	reviewedDays := 0
	activities := make([]Activity, 0)
	for _, day := range days {
		if len(day.Activities) > 0 {
			activeDays++
		}
		if day.Review != nil {
			reviewedDays++
		}
		for _, activity := range day.Activities {
			facts.Activities++
			activities = append(activities, activity)
			switch activity.Kind {
			case "started":
				facts.Started++
			case "completed":
				facts.ConfirmedRecords++
			case "sealed":
				facts.SealedRecords++
			}
		}
	}
	for left, right := 0, len(activities)-1; left < right; left, right = left+1, right-1 {
		activities[left], activities[right] = activities[right], activities[left]
	}
	if len(activities) > sharedconstants.WorkOverviewRecentActivityLimit {
		activities = activities[:sharedconstants.WorkOverviewRecentActivityLimit]
	}
	return facts, activeDays, reviewedDays, activities
}

func actionStateConfidence(windowDays, activities, activeDays int) string {
	if activities < 3 || activeDays == 0 {
		return "low"
	}
	if activities >= 15 && activeDays >= 7 && windowDays >= 7 {
		return "high"
	}
	return "medium"
}

func actionStateComparisonConclusion(currentActivities, previousActivities, currentDays, previousDays int) string {
	if currentActivities == 0 && previousActivities == 0 {
		return "暂无足够记录判断变化"
	}
	if currentActivities > previousActivities && currentDays >= previousDays {
		return "近期留下的推进记录更多，仍需结合负荷和具体内容理解"
	}
	if currentActivities < previousActivities {
		return "近期记录较少，不能仅凭记录数量判断状态变差"
	}
	return "近期记录量与上一周期接近"
}
