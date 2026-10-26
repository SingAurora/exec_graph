// Package storage 实现独立命名空间下的对象存储，不对旧对象执行扫描或回退。
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	cos "github.com/tencentyun/cos-go-sdk-v5"
)

// Objects 对明确的演示键读取内嵌资源，对真实上传键使用云存储；两者互不回退。
type Objects struct {
	client *cos.Client
	prefix string
}

// Disabled 显式关闭云端写入，仅提供已有演示键读取。
func Disabled() *Objects { return &Objects{prefix: "exec-graph/v1/media/"} }

// New 创建云客户端但不发网络请求；关闭能力时仍能读取明确的演示资源。
func New(c config.ObjectStorage, credentials config.Credentials) (*Objects, error) {
	prefix := strings.Trim(c.MediaPrefix, "/")
	if prefix == "" {
		prefix = "exec-graph/v1/media"
	}
	if path.Clean(prefix) != prefix || strings.ContainsAny(prefix, "\\?#%") || strings.HasPrefix(prefix, "demo/") || strings.Contains(prefix, "..") {
		return nil, fmt.Errorf("storage.media_prefix 不合法")
	}
	out := &Objects{prefix: prefix + "/"}
	if !c.Enabled {
		return out, nil
	}
	if c.Region == "" || c.Bucket == "" || credentials.AccessKeyID == "" || credentials.AccessKeySecret == "" {
		return nil, fmt.Errorf("启用对象存储需要完整配置和凭据")
	}
	bucket, err := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", c.Bucket, c.Region))
	if err != nil || bucket.Hostname() != c.Bucket+".cos."+c.Region+".myqcloud.com" || bucket.Path != "" || bucket.User != nil {
		return nil, fmt.Errorf("对象存储区域或桶名不合法")
	}
	out.client = cos.NewClient(&cos.BaseURL{BucketURL: bucket}, &http.Client{
		Timeout:   constants.MediaOperationTimeout,
		Transport: &cos.AuthorizationTransport{SecretID: credentials.AccessKeyID, SecretKey: credentials.AccessKeySecret},
	})
	return out, nil
}

// Key 只生成该版本独占前缀下的 UUID 文件名，不沿用旧头像目录。
func (s *Objects) Key(uuid, format string) (string, error) {
	if s.client == nil {
		return "", fault.New(fault.Unavailable, "图片上传暂未启用")
	}
	ext := map[string]string{"jpeg": ".jpg", "png": ".png", "webp": ".webp"}[format]
	if !id.Valid(uuid) || ext == "" {
		return "", fmt.Errorf("图片对象身份或格式不合法")
	}
	return s.prefix + uuid + ext, nil
}

func (s *Objects) managed(key string) bool {
	name := strings.TrimPrefix(key, s.prefix)
	ext := path.Ext(name)
	return strings.HasPrefix(key, s.prefix) && (ext == ".jpg" || ext == ".png" || ext == ".webp") && id.Valid(strings.TrimSuffix(name, ext))
}

func (s *Objects) check(key string) error {
	if s.client == nil {
		return fault.New(fault.Unavailable, "对象存储暂未启用")
	}
	if !s.managed(key) {
		return fmt.Errorf("对象不属于本版本上传目录")
	}
	return nil
}

// Put 将已识别的图片写入私有存储对象，不设置公开读 ACL。
func (s *Objects) Put(ctx context.Context, key, mime string, body []byte) error {
	if err := s.check(key); err != nil {
		return err
	}
	_, err := s.client.Object.Put(ctx, key, bytes.NewReader(body), &cos.ObjectPutOptions{ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{ContentType: mime, ContentLength: int64(len(body)), CacheControl: "private, no-store"}})
	return err
}

// Read 读取已授权对象；云存储异常直接上抛，不读取任何替代图片。
func (s *Objects) Read(ctx context.Context, key string) ([]byte, error) {
	if strings.HasPrefix(key, "demo/v1/") {
		return (demomedia.Files{}).Read(ctx, key)
	}
	if err := s.check(key); err != nil {
		return nil, err
	}
	response, err := s.client.Object.Get(ctx, key, nil)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, constants.MaxImageBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > constants.MaxImageBytes {
		return nil, fmt.Errorf("存储对象超过图片读取上限")
	}
	return body, nil
}

// Delete 仅允许删除本版本 UUID 上传对象；不存在的对象由存储服务按幂等删除处理。
func (s *Objects) Delete(ctx context.Context, key string) error {
	if err := s.check(key); err != nil {
		return err
	}
	_, err := s.client.Object.Delete(ctx, key)
	return err
}
