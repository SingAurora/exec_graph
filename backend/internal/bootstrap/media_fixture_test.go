package bootstrap

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"sync"
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
)

// memoryObjects 仅是隔离网络失败的测试替身，不用于运行时或依赖失败回退。
type memoryObjects struct {
	mu                  sync.Mutex
	files               map[string][]byte
	failPut, failDelete bool
}

func (s *memoryObjects) Key(uuid, format string) (string, error) {
	return "test/media/" + uuid + "." + format, nil
}
func (s *memoryObjects) Put(ctx context.Context, key, mime string, body []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.files[key] = append([]byte{}, body...)
	if s.failPut {
		return fmt.Errorf("测试：存储成功但响应中断")
	}
	return nil
}
func (s *memoryObjects) Read(ctx context.Context, key string) ([]byte, error) {
	if strings.HasPrefix(key, "demo/v1/") {
		return (demomedia.Files{}).Read(ctx, key)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	body, ok := s.files[key]
	if !ok {
		return nil, fmt.Errorf("测试对象不存在")
	}
	return append([]byte{}, body...), nil
}
func (s *memoryObjects) Delete(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failDelete {
		return fmt.Errorf("测试：云端删除暂时失败")
	}
	delete(s.files, key)
	return nil
}

func (c writeClient) upload(t *testing.T, body []byte, status int) app.AssetView {
	t.Helper()
	out, err := c.sendUpload(body)
	if err != nil {
		t.Fatal(err)
	}
	if out.status != status {
		t.Fatalf("上传: HTTP %d，期望 %d，%s", out.status, status, out.message)
	}
	if status != 200 {
		return app.AssetView{}
	}
	return decode[app.AssetView](t, out.data)
}

func (c writeClient) sendUpload(body []byte) (commandResponse, error) {
	var form bytes.Buffer
	w := multipart.NewWriter(&form)
	file, err := w.CreateFormFile("file", "client-filename-is-untrusted.exe")
	if err != nil {
		return commandResponse{}, err
	}
	if _, err := file.Write(body); err != nil {
		return commandResponse{}, err
	}
	if err := w.Close(); err != nil {
		return commandResponse{}, err
	}
	req, err := http.NewRequest("POST", c.url+"/api/commands/media/upload", &form)
	if err != nil {
		return commandResponse{}, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("X-CSRF-Token", c.csrf)
	req.AddCookie(&http.Cookie{Name: "exec_graph_v1_session", Value: c.token})
	res, err := c.http.Do(req)
	if err != nil {
		return commandResponse{}, err
	}
	defer res.Body.Close()
	var wire wire[json.RawMessage]
	if err := json.NewDecoder(res.Body).Decode(&wire); err != nil {
		return commandResponse{}, err
	}
	return commandResponse{status: res.StatusCode, data: wire.Data, code: wire.Code, message: wire.Message}, nil
}

func (c writeClient) image(t *testing.T, url string, status int, expected []byte) {
	t.Helper()
	req, err := http.NewRequest("GET", c.url+url, nil)
	if err != nil {
		t.Fatal(err)
	}
	if c.token != "" {
		req.AddCookie(&http.Cookie{Name: "exec_graph_v1_session", Value: c.token})
	}
	res, err := c.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != status {
		t.Fatalf("读取图片: HTTP %d，期望 %d: %s", res.StatusCode, status, body)
	}
	if status == 200 && (!bytes.Equal(body, expected) || res.Header.Get("X-Content-Type-Options") != "nosniff") {
		t.Fatal("图片字节或安全响应头不正确")
	}
}
