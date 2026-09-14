package app

import (
	"fmt"

	infrastructureprotocol "github.com/singaurora/exec-graph/backend/internal/infrastructure/ai/protocol"
)

type reasoningOnlyResponseError = infrastructureprotocol.ReasoningOnlyResponseError

func extractAIMessageContent(provider string, body []byte) (string, error) {
	definition, ok := aiProviderDefinitions[provider]
	if !ok {
		return "", fmt.Errorf("AI 服务不支持")
	}
	return infrastructureprotocol.ExtractMessageContent(definition.AuthStyle, body)
}

func extractJSONObject(value string) string {
	return infrastructureprotocol.ExtractJSONObject(value)
}
