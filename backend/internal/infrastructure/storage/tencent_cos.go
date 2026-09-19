package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	cos "github.com/tencentyun/cos-go-sdk-v5"
)

type ObjectStorage interface {
	NewObjectKey(parts ...string) (string, error)
	PutObject(ctx context.Context, objectKey, contentType string, contents []byte, cacheControl string) error
	SignedObjectURL(ctx context.Context, objectKey string, expires time.Duration) (string, error)
	DeleteObject(ctx context.Context, objectKey string) error
	IsManagedObjectKey(objectKey string) bool
}

type COSStorage struct {
	client       *cos.Client
	bucketURL    *url.URL
	objectPrefix string
	secretID     string
	secretKey    string
}

func NewTencentCOS(config bootstrapconfig.ObjectStorageConfig, credentials bootstrapconfig.CredentialsConfig) (*COSStorage, error) {
	if config.Region == "" || config.Bucket == "" || credentials.AccessKeyID == "" || credentials.AccessKeySecret == "" {
		return nil, fmt.Errorf("incomplete Tencent COS configuration")
	}
	bucketURL, err := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", config.Bucket, config.Region))
	if err != nil {
		return nil, fmt.Errorf("parse COS bucket URL: %w", err)
	}
	baseURL := &cos.BaseURL{BucketURL: bucketURL}
	client := cos.NewClient(baseURL, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  credentials.AccessKeyID,
			SecretKey: credentials.AccessKeySecret,
		},
	})
	return &COSStorage{
		client:       client,
		bucketURL:    bucketURL,
		objectPrefix: normalizeObjectPrefix(config.AvatarPrefix),
		secretID:     credentials.AccessKeyID,
		secretKey:    credentials.AccessKeySecret,
	}, nil
}

func normalizeObjectPrefix(prefix string) string {
	prefix = strings.Trim(strings.TrimSpace(prefix), "/")
	if prefix == "" {
		return ""
	}
	return prefix + "/"
}

func (storage *COSStorage) Check(ctx context.Context) error {
	response, err := storage.client.Bucket.Head(ctx)
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected COS bucket status: %d", response.StatusCode)
	}
	return nil
}

// NewObjectKey creates an object key below the configured application prefix.
// The caller owns the meaning of each path part, while storage owns the boundary.
func (storage *COSStorage) NewObjectKey(parts ...string) (string, error) {
	if len(parts) == 0 {
		return "", fmt.Errorf("object key requires at least one path part")
	}
	for _, part := range parts {
		if strings.TrimSpace(part) == "" || path.IsAbs(part) || strings.Contains(part, "\\") || strings.Contains(part, "..") {
			return "", fmt.Errorf("invalid object key path part")
		}
	}
	keyParts := make([]string, 0, len(parts)+1)
	if storage.objectPrefix != "" {
		keyParts = append(keyParts, strings.TrimSuffix(storage.objectPrefix, "/"))
	}
	keyParts = append(keyParts, parts...)
	objectKey := path.Join(keyParts...)
	if !storage.IsManagedObjectKey(objectKey) {
		return "", fmt.Errorf("invalid object key")
	}
	return objectKey, nil
}

func (storage *COSStorage) PutObject(ctx context.Context, objectKey, contentType string, contents []byte, cacheControl string) error {
	if !storage.IsManagedObjectKey(objectKey) {
		return fmt.Errorf("invalid object key")
	}
	_, err := storage.client.Object.Put(ctx, objectKey, bytes.NewReader(contents), &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType:   contentType,
			ContentLength: int64(len(contents)),
			CacheControl:  cacheControl,
		},
	})
	if err != nil {
		return fmt.Errorf("upload object to COS: %w", err)
	}
	return nil
}

func (storage *COSStorage) SignedObjectURL(ctx context.Context, objectKey string, expires time.Duration) (string, error) {
	if !storage.IsManagedObjectKey(objectKey) {
		return "", fmt.Errorf("invalid object key")
	}
	if expires <= 0 {
		return "", fmt.Errorf("object URL expiration must be positive")
	}
	signedURL, err := storage.client.Object.GetPresignedURL(
		ctx,
		http.MethodGet,
		objectKey,
		storage.secretID,
		storage.secretKey,
		expires,
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("sign object URL: %w", err)
	}
	return signedURL.String(), nil
}

func (storage *COSStorage) DeleteObject(ctx context.Context, objectKey string) error {
	if !storage.IsManagedObjectKey(objectKey) {
		return nil
	}
	if _, err := storage.client.Object.Delete(ctx, objectKey); err != nil {
		return fmt.Errorf("delete object from COS: %w", err)
	}
	return nil
}

func (storage *COSStorage) IsManagedObjectKey(objectKey string) bool {
	return objectKey != "" &&
		!path.IsAbs(objectKey) &&
		path.Clean(objectKey) == objectKey &&
		!strings.Contains(objectKey, "\\") &&
		!strings.Contains(objectKey, "..") &&
		strings.HasPrefix(objectKey, storage.objectPrefix)
}

func ImageExtension(contentType string) (string, bool) {
	switch contentType {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	case "image/webp":
		return ".webp", true
	default:
		return "", false
	}
}
