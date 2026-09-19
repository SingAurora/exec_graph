package aikey

var providers = map[string]Provider{
	"deepseek": {Label: "DeepSeek", DefaultBaseURL: "https://api.deepseek.com/v1", AuthStyle: "openai"},
	"openai":   {Label: "OpenAI", DefaultBaseURL: "https://api.openai.com/v1", AuthStyle: "openai"},
	"doubao":   {Label: "豆包", DefaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3", AuthStyle: "openai"},
	"claude":   {Label: "Claude", DefaultBaseURL: "https://api.anthropic.com/v1", AuthStyle: "anthropic"},
}
