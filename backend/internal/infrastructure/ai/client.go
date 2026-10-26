// Package ai 实现平台配置的 OpenAI 兼容模型客户端，不提供通用转发代理。
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Client 只使用组合根传入的平台配置。
type Client struct {
	endpoint, model, key string
	http                 *http.Client
}

// Disabled 显式关闭未配置平台密钥的生成能力。
func Disabled() *Client { return &Client{} }

// New 创建有超时和重定向限制的模型客户端。
func New(c config.AI) (*Client, error) {
	base, err := url.Parse(c.BaseURL)
	if err != nil || base.Scheme != "https" || base.Host == "" || base.User != nil || base.RawQuery != "" || base.Fragment != "" || len(c.Model) > 100 {
		return nil, fmt.Errorf("平台 AI 地址或模型配置不合法")
	}
	return &Client{endpoint: strings.TrimRight(c.BaseURL, "/") + "/chat/completions", model: c.Model, key: c.APIKey, http: &http.Client{Timeout: constants.AITimeout, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

// Model 密钥未配置时返回空，生成用例明确拒绝请求。
func (c *Client) Model() string {
	if c.key == "" {
		return ""
	}
	return c.model
}

type completionRequest struct {
	Model          string        `json:"model"`
	Messages       []app.Message `json:"messages"`
	ResponseFormat struct {
		Type string `json:"type"`
	} `json:"response_format"`
	Thinking struct {
		Type string `json:"type"`
	} `json:"thinking"`
	MaxTokens int `json:"max_tokens"`
}
type completionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		Input  uint32 `json:"prompt_tokens"`
		Output uint32 `json:"completion_tokens"`
	} `json:"usage"`
}

// Complete 只接受业务生成用例构造的消息，不向前端返回上游报错正文或认证信息。
func (c *Client) Complete(ctx context.Context, messages []app.Message) (app.Completion, error) {
	if c.Model() == "" {
		return app.Completion{}, fault.New(fault.Unavailable, "平台 AI 暂未启用")
	}
	input := completionRequest{Model: c.model, Messages: messages, MaxTokens: constants.AIOutputTokens}
	input.ResponseFormat.Type, input.Thinking.Type = "json_object", "disabled"
	body, err := json.Marshal(input)
	if err != nil {
		return app.Completion{}, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
	if err != nil {
		return app.Completion{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.key)
	res, err := c.http.Do(req)
	if err != nil {
		return app.Completion{}, fmt.Errorf("平台 AI 网络请求失败")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return app.Completion{}, fmt.Errorf("平台 AI 返回状态 %d", res.StatusCode)
	}
	contents, err := io.ReadAll(io.LimitReader(res.Body, constants.MaxJSONBytes+1))
	if err != nil || len(contents) > constants.MaxJSONBytes {
		return app.Completion{}, fmt.Errorf("平台 AI 响应读取失败或过大")
	}
	var out completionResponse
	if err := json.Unmarshal(contents, &out); err != nil || len(out.Choices) != 1 || out.Choices[0].FinishReason != "stop" || strings.TrimSpace(out.Choices[0].Message.Content) == "" {
		return app.Completion{}, fmt.Errorf("平台 AI 响应不完整")
	}
	return app.Completion{Content: out.Choices[0].Message.Content, InputTokens: out.Usage.Input, OutputTokens: out.Usage.Output}, nil
}
