package media

import (
	"errors"
	"math"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func TestUploadLimits(t *testing.T) {
	l := Limits{DailyRequests: 100, MinuteRequests: 20, StorageBytes: 1000}
	for _, tc := range []struct {
		usage Usage
		size  uint64
		allow bool
	}{
		{Usage{}, 1000, true},
		{Usage{99, 19, 900}, 100, true},
		{Usage{DailyRequests: 100}, 1, false},
		{Usage{MinuteRequests: 20}, 1, false},
		{Usage{StorageBytes: 900}, 101, false},
		{Usage{StorageBytes: 1001}, 1, false},
		{Usage{StorageBytes: math.MaxUint64}, 1, false},
		{Usage{StorageBytes: 1}, math.MaxUint64, false},
	} {
		err := l.Check(tc.usage, tc.size)
		if tc.allow && err != nil {
			t.Fatal(err)
		}
		var known *fault.Error
		if !tc.allow && (!errors.As(err, &known) || known.Code != fault.TooMany) {
			t.Fatalf("应拒绝超限或溢出容量: %+v %v", tc.usage, err)
		}
	}
}
