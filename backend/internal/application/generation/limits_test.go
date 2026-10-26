package generation

import (
	"errors"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func TestGenerationLimits(t *testing.T) {
	l := Limits{DailyRequests: 100, MinuteRequests: 10, ConcurrentRequests: 2}
	for _, tc := range []struct {
		usage Usage
		allow bool
	}{
		{Usage{}, true},
		{Usage{99, 9, 1}, true},
		{Usage{DailyRequests: 100}, false},
		{Usage{MinuteRequests: 10}, false},
		{Usage{PendingRequests: 2}, false},
	} {
		err := l.Check(tc.usage)
		if tc.allow && err != nil {
			t.Fatal(err)
		}
		var known *fault.Error
		if !tc.allow && (!errors.As(err, &known) || known.Code != fault.TooMany) {
			t.Fatalf("应拒绝超限: %+v %v", tc.usage, err)
		}
	}
}
