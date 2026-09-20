// Package ai implements access to external AI providers.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	aiprotocol "github.com/singaurora/exec-graph/backend/internal/infrastructure/ai/protocol"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

const maximumRedirects = 3

var nonPublicNetworkPrefixes = []netip.Prefix{
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("198.18.0.0/15"),
}

// ProviderClient performs outbound AI provider requests with SSRF protections.
type ProviderClient struct {
	resolver *net.Resolver
	dialer   *net.Dialer
}

// NewProviderClient creates a client that only connects to public HTTPS hosts.
func NewProviderClient() *ProviderClient {
	return &ProviderClient{
		resolver: net.DefaultResolver,
		dialer:   &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second},
	}
}

// Verify checks an AI provider credential with a minimal generation request.
func (client *ProviderClient) Verify(ctx context.Context, provider, apiKey, baseURL, model string) error {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"
	payload := map[string]any{
		"model": model, "max_tokens": 8, "temperature": 0,
		"messages": []map[string]string{{"role": "user", "content": "ping"}},
	}
	if provider == "claude" {
		endpoint = strings.TrimRight(baseURL, "/") + "/messages"
		payload = map[string]any{
			"model": model, "max_tokens": 8,
			"messages": []map[string]string{{"role": "user", "content": "ping"}},
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode AI probe: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return errors.New("AI 服务地址不正确")
	}
	if err := client.validateURL(ctx, request.URL); err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	if provider == "claude" {
		request.Header.Set("x-api-key", apiKey)
		request.Header.Set("anthropic-version", "2023-06-01")
	} else {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}
	response, err := client.httpClient().Do(request)
	if err != nil {
		return errors.New("无法连接 AI 服务，请检查地址、模型和网络")
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return errors.New("AI 服务未接受此密钥或模型，请检查 API Key、服务地址和模型名称")
	}
	return nil
}

// GenerateContent performs one provider-neutral text generation request.
func (client *ProviderClient) GenerateContent(ctx context.Context, input applicationaigateway.GenerateInput) (string, error) {
	credential := input.Credential
	endpoint := strings.TrimRight(credential.BaseURL, "/") + "/chat/completions"
	payload := map[string]any{
		"model": credential.Model, "max_tokens": input.MaxTokens, "temperature": 0,
		"messages": []map[string]string{{"role": "system", "content": input.System}, {"role": "user", "content": input.User}},
	}
	authStyle := "openai"
	if input.JSONMode {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	if credential.Provider == "claude" {
		authStyle = "anthropic"
		endpoint = strings.TrimRight(credential.BaseURL, "/") + "/messages"
		payload = map[string]any{
			"model": credential.Model, "max_tokens": input.MaxTokens, "temperature": 0,
			"system":   input.System,
			"messages": []map[string]string{{"role": "user", "content": input.User}},
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encode AI request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", errors.New("AI 服务地址不正确")
	}
	if err := client.validateURL(ctx, request.URL); err != nil {
		return "", err
	}
	request.Header.Set("Content-Type", "application/json")
	if authStyle == "anthropic" {
		request.Header.Set("x-api-key", credential.APIKey)
		request.Header.Set("anthropic-version", "2023-06-01")
	} else {
		request.Header.Set("Authorization", "Bearer "+credential.APIKey)
	}
	response, err := client.httpClient().Do(request)
	if err != nil {
		return "", errors.New("无法连接 AI 服务，请检查项目 AI 配置和网络")
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return "", errors.New("读取 AI 回复失败")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("AI 服务商返回 HTTP %d", response.StatusCode)
	}
	content, err := aiprotocol.ExtractMessageContent(authStyle, responseBody)
	if err != nil {
		var reasoningOnly aiprotocol.ReasoningOnlyResponseError
		if errors.As(err, &reasoningOnly) {
			return "", applicationaigateway.ReasoningOnlyError{Reasoning: reasoningOnly.Reasoning}
		}
	}
	return content, err
}

func (client *ProviderClient) httpClient() *http.Client {
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           client.dialContext,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: sharedconstants.AIKeyProbeHTTPTimeout,
		IdleConnTimeout:       30 * time.Second,
	}
	return &http.Client{
		Transport: transport,
		Timeout:   sharedconstants.AIKeyProbeHTTPTimeout,
		CheckRedirect: func(request *http.Request, via []*http.Request) error {
			if len(via) >= maximumRedirects {
				return errors.New("AI 服务重定向次数过多")
			}
			return client.validateURL(request.Context(), request.URL)
		},
	}
}

func (client *ProviderClient) dialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("parse AI provider address: %w", err)
	}
	addresses, err := client.resolvePublicAddresses(ctx, host)
	if err != nil {
		return nil, err
	}
	var dialErrors []error
	for _, address := range addresses {
		connection, dialErr := client.dialer.DialContext(ctx, network, net.JoinHostPort(address.String(), port))
		if dialErr == nil {
			return connection, nil
		}
		dialErrors = append(dialErrors, dialErr)
	}
	return nil, errors.Join(dialErrors...)
}

func (client *ProviderClient) validateURL(ctx context.Context, target *url.URL) error {
	if target == nil || target.Scheme != "https" || target.Hostname() == "" || target.User != nil {
		return errors.New("AI 服务地址必须是公开的 HTTPS 地址")
	}
	if _, err := client.resolvePublicAddresses(ctx, target.Hostname()); err != nil {
		return errors.New("AI 服务地址不能指向本机、内网或保留地址")
	}
	return nil
}

func (client *ProviderClient) resolvePublicAddresses(ctx context.Context, host string) ([]netip.Addr, error) {
	if address, err := netip.ParseAddr(host); err == nil {
		address = address.Unmap()
		if !isPublicAddress(address) {
			return nil, errors.New("non-public address")
		}
		return []netip.Addr{address}, nil
	}
	resolved, err := client.resolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(resolved) == 0 {
		return nil, errors.New("resolve AI provider host")
	}
	addresses := make([]netip.Addr, 0, len(resolved))
	for _, address := range resolved {
		address = address.Unmap()
		if !isPublicAddress(address) {
			return nil, errors.New("host resolves to non-public address")
		}
		addresses = append(addresses, address)
	}
	return addresses, nil
}

func isPublicAddress(address netip.Addr) bool {
	if !address.IsValid() || address.IsUnspecified() || address.IsLoopback() ||
		address.IsPrivate() || address.IsLinkLocalUnicast() || address.IsLinkLocalMulticast() ||
		address.IsMulticast() {
		return false
	}
	for _, prefix := range nonPublicNetworkPrefixes {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}
