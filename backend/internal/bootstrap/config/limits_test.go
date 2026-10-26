package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestLimitsConfiguration(t *testing.T) {
	body, err := os.ReadFile("../../../etc/config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	base := strings.Split(string(body), "# 所有值必须为正整数")[0]
	for _, tc := range []struct {
		name, extra string
		invalid     bool
	}{
		{"defaults", "", false},
		{"partial", "limits:\n  ai:\n    daily_requests: 7\n", false},
		{"zero", "limits:\n  ai:\n    daily_requests: 0\n", true},
		{"negative", "limits:\n  media:\n    minute_requests: -1\n", true},
		{"negative capacity", "limits:\n  media:\n    storage_bytes: -1\n", true},
		{"zero capacity", "limits:\n  media:\n    storage_bytes: 0\n", true},
		{"fraction", "limits:\n  ai:\n    concurrent_requests: 1.5\n", true},
		{"unknown", "limits:\n  ai:\n    unknown: 1\n", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "config.yaml")
			if err := os.WriteFile(path, []byte(base+tc.extra), 0600); err != nil {
				t.Fatal(err)
			}
			c, err := Load(path)
			if tc.invalid {
				if err == nil {
					t.Fatal("不合法限额配置被接受")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			want := int64(constants.DefaultAIDailyRequests)
			if tc.name == "partial" {
				want = 7
			}
			if c.Limits.AI.DailyRequests != want || c.Limits.AI.MinuteRequests != constants.DefaultAIMinuteRequests || c.Limits.AI.ConcurrentRequests != constants.DefaultAIConcurrentRequests || c.Limits.Media.StorageBytes != constants.DefaultMediaStorageBytes || c.Limits.Media.DailyRequests != constants.DefaultUploadDailyRequests || c.Limits.Media.MinuteRequests != constants.DefaultUploadMinuteRequests {
				t.Fatalf("缺省字段或覆盖字段不正确: %+v", c.Limits)
			}
		})
	}
}
