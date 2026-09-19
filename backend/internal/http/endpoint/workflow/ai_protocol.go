package workflow

import (
	"fmt"

	infrastructureprotocol "github.com/singaurora/exec-graph/backend/internal/infrastructure/ai/protocol"
)

type reasoningOnlyResponseError = infrastructureprotocol.ReasoningOnlyResponseError

type aiProviderDefinition struct {
	AuthStyle string
}

var aiProviderDefinitions = map[string]aiProviderDefinition{
	"deepseek": {AuthStyle: "openai"},
	"openai":   {AuthStyle: "openai"},
	"doubao":   {AuthStyle: "openai"},
	"claude":   {AuthStyle: "anthropic"},
}

var aiProviderAuthStyles = map[string]string{
	"deepseek": "openai",
	"openai":   "openai",
	"doubao":   "openai",
	"claude":   "anthropic",
}

func extractAIMessageContent(provider string, body []byte) (string, error) {
	authStyle, ok := aiProviderAuthStyles[provider]
	if !ok {
		return "", fmt.Errorf("AI 服务不支持")
	}
	return infrastructureprotocol.ExtractMessageContent(authStyle, body)
}

func extractJSONObject(value string) string {
	return infrastructureprotocol.ExtractJSONObject(value)
}
