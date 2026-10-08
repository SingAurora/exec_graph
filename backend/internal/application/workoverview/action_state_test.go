package workoverview

import (
	"testing"
	"time"
)

func TestResolveActionStateRange(t *testing.T) {
	location := time.Local
	now := time.Date(2026, 9, 22, 15, 30, 0, 0, location)
	tests := []struct {
		window        string
		start         time.Time
		previousStart time.Time
		windowDays    int
	}{
		{window: ActionWindowToday, start: time.Date(2026, 9, 22, 0, 0, 0, 0, location), previousStart: time.Date(2026, 9, 21, 0, 0, 0, 0, location), windowDays: 1},
		{window: ActionWindowSevenDays, start: time.Date(2026, 9, 16, 0, 0, 0, 0, location), previousStart: time.Date(2026, 9, 9, 0, 0, 0, 0, location), windowDays: 7},
		{window: ActionWindowThirtyDays, start: time.Date(2026, 8, 24, 0, 0, 0, 0, location), previousStart: time.Date(2026, 7, 25, 0, 0, 0, 0, location), windowDays: 30},
	}

	for _, test := range tests {
		period, err := resolveActionStateRange(test.window, now)
		if err != nil {
			t.Fatalf("resolveActionStateRange(%q): %v", test.window, err)
		}
		if !period.start.Equal(test.start) || !period.previousStart.Equal(test.previousStart) || period.windowDays != test.windowDays || !period.end.Equal(now) || !period.partial {
			t.Fatalf("resolveActionStateRange(%q) = %+v", test.window, period)
		}
	}
}

func TestResolveActionStateRangeRejectsUnknownWindow(t *testing.T) {
	if _, err := resolveActionStateRange("90d", time.Now()); err == nil {
		t.Fatal("resolveActionStateRange() accepted an unknown window")
	}
}

func TestBuildActionStateSummarizesFactsAndRecentActivities(t *testing.T) {
	period, err := resolveActionStateRange(ActionWindowSevenDays, time.Date(2026, 9, 22, 15, 30, 0, 0, time.Local))
	if err != nil {
		t.Fatalf("resolve period: %v", err)
	}
	first := Activity{ID: "first", Kind: "started", CreatedAt: time.Date(2026, 9, 20, 9, 0, 0, 0, time.Local)}
	second := Activity{ID: "second", Kind: "completed", CreatedAt: time.Date(2026, 9, 21, 10, 0, 0, 0, time.Local)}
	third := Activity{ID: "third", Kind: "sealed", CreatedAt: time.Date(2026, 9, 22, 11, 0, 0, 0, time.Local)}
	state := buildActionState(period, []Day{
		{Date: "2026-09-20", Activities: []Activity{first}},
		{Date: "2026-09-21", Activities: []Activity{second}, Review: &DailyReview{ID: "review"}},
		{Date: "2026-09-22", Activities: []Activity{third}},
	}, []Day{{Date: "2026-09-15", Activities: []Activity{{ID: "old", Kind: "started"}}}})

	if state.Facts != (ActionStateFacts{Activities: 3, Started: 1, ConfirmedRecords: 1, SealedRecords: 1}) {
		t.Fatalf("facts = %+v", state.Facts)
	}
	if state.Coverage.ActiveDays != 3 || state.Coverage.ReviewedDays != 1 || state.Coverage.Confidence != "medium" {
		t.Fatalf("coverage = %+v", state.Coverage)
	}
	if len(state.RecentActivities) != 3 || state.RecentActivities[0].ID != "third" || state.Comparison.ActivityChange != 2 {
		t.Fatalf("state = %+v", state)
	}
}
