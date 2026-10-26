package config

import (
	"fmt"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gopkg.in/yaml.v3"
)

// Limits 保存平台对每个账号的外部资源限额，不能由客户端覆盖。
type Limits struct {
	AI    GenerationLimits `yaml:"ai"`
	Media UploadLimits     `yaml:"media"`
}

// GenerationLimits 限制受理次数与尚未超时的在途生成数。
type GenerationLimits struct {
	DailyRequests      int64 `yaml:"daily_requests"`
	MinuteRequests     int64 `yaml:"minute_requests"`
	ConcurrentRequests int64 `yaml:"concurrent_requests"`
}

// UploadLimits 限制受理次数和未确认删除的真实对象总容量。
type UploadLimits struct {
	DailyRequests  int64  `yaml:"daily_requests"`
	MinuteRequests int64  `yaml:"minute_requests"`
	StorageBytes   uint64 `yaml:"storage_bytes"`
}

func defaultLimits() Limits {
	return Limits{
		AI:    GenerationLimits{constants.DefaultAIDailyRequests, constants.DefaultAIMinuteRequests, constants.DefaultAIConcurrentRequests},
		Media: UploadLimits{constants.DefaultUploadDailyRequests, constants.DefaultUploadMinuteRequests, constants.DefaultMediaStorageBytes},
	}
}

func (l Limits) validate() error {
	if l.AI.DailyRequests <= 0 || l.AI.MinuteRequests <= 0 || l.AI.ConcurrentRequests <= 0 || l.Media.DailyRequests <= 0 || l.Media.MinuteRequests <= 0 || l.Media.StorageBytes == 0 {
		return fmt.Errorf("limits 中的次数、并发数和容量必须为正整数；省略字段使用默认限额")
	}
	return nil
}

// yaml.v3 默认会截断浮点数，限额字段必须显式使用整数标量。
func validateLimitNumbers(contents []byte) error {
	var document yaml.Node
	if err := yaml.Unmarshal(contents, &document); err != nil {
		return fmt.Errorf("配置 YAML 格式不合法")
	}
	if len(document.Content) != 1 || document.Content[0].Kind != yaml.MappingNode {
		return fmt.Errorf("配置必须为 YAML 映射")
	}
	root := document.Content[0]
	for i := 0; i < len(root.Content); i += 2 {
		if root.Content[i].Value != "limits" {
			continue
		}
		return integerMapping(root.Content[i+1], 2)
	}
	return nil
}

func integerMapping(node *yaml.Node, depth int) error {
	if depth == 0 && node.Kind == yaml.ScalarNode && node.Tag == "!!int" {
		return nil
	}
	if depth > 0 && node.Kind == yaml.MappingNode {
		for i := 1; i < len(node.Content); i += 2 {
			if err := integerMapping(node.Content[i], depth-1); err != nil {
				return err
			}
		}
		return nil
	}
	return fmt.Errorf("limits 必须按能力分组配置整数，不能使用小数、文本或别名")
}
