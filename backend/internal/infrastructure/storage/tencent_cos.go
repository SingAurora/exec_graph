package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
	cos "github.com/tencentyun/cos-go-sdk-v5"
)

type COSStorage struct {
	client       *cos.Client
	bucketURL    *url.URL
	avatarPrefix string
	secretID     string
	secretKey    string
}

func NewTencentCOS(config bootstrapconfig.COSConfig, credentials bootstrapconfig.SESConfig) (*COSStorage, error) {
	if config.Region == "" || config.Bucket == "" || credentials.SecretID == "" || credentials.SecretKey == "" {
		return nil, fmt.Errorf("incomplete Tencent COS configuration")
	}
	bucketURL, err := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", config.Bucket, config.Region))
	if err != nil {
		return nil, fmt.Errorf("parse COS bucket URL: %w", err)
	}
	baseURL := &cos.BaseURL{BucketURL: bucketURL}
	client := cos.NewClient(baseURL, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  credentials.SecretID,
			SecretKey: credentials.SecretKey,
		},
	})
	return &COSStorage{
		client:       client,
		bucketURL:    bucketURL,
		avatarPrefix: strings.Trim(strings.TrimSpace(config.AvatarPrefix), "/") + "/",
		secretID:     credentials.SecretID,
		secretKey:    credentials.SecretKey,
	}, nil
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

func (storage *COSStorage) PutAvatar(ctx context.Context, userID uint64, contentType string, contents []byte) (string, string, error) {
	extension, ok := AvatarExtension(contentType)
	if !ok {
		return "", "", fmt.Errorf("unsupported avatar content type: %s", contentType)
	}
	name, err := sharedid.Opaque("avatar")
	if err != nil {
		return "", "", err
	}
	objectKey := path.Join(storage.avatarPrefix, strconv.FormatUint(userID, 10), name+extension)
	_, err = storage.client.Object.Put(ctx, objectKey, bytes.NewReader(contents), &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType:   contentType,
			ContentLength: int64(len(contents)),
			CacheControl:  "private, max-age=86400",
		},
	})
	if err != nil {
		return "", "", fmt.Errorf("upload avatar to COS: %w", err)
	}
	avatarURL, err := storage.SignedAvatarURL(ctx, objectKey)
	if err != nil {
		_ = storage.DeleteAvatar(ctx, objectKey)
		return "", "", err
	}
	return objectKey, avatarURL, nil
}

func (storage *COSStorage) PutProfileBackground(ctx context.Context, userID uint64, contentType string, contents []byte) (string, string, error) {
	extension, ok := AvatarExtension(contentType)
	if !ok {
		return "", "", fmt.Errorf("unsupported profile background content type: %s", contentType)
	}
	name, err := sharedid.Opaque("background")
	if err != nil {
		return "", "", err
	}
	objectKey := path.Join(storage.avatarPrefix, strconv.FormatUint(userID, 10), name+extension)
	_, err = storage.client.Object.Put(ctx, objectKey, bytes.NewReader(contents), &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType:   contentType,
			ContentLength: int64(len(contents)),
			CacheControl:  "private, max-age=86400",
		},
	})
	if err != nil {
		return "", "", fmt.Errorf("upload profile background to COS: %w", err)
	}
	backgroundURL, err := storage.SignedProfileBackgroundURL(ctx, objectKey)
	if err != nil {
		_ = storage.DeleteProfileBackground(ctx, objectKey)
		return "", "", err
	}
	return objectKey, backgroundURL, nil
}

func (storage *COSStorage) SignedAvatarURL(ctx context.Context, objectKey string) (string, error) {
	if !storage.IsAvatarKey(objectKey) {
		return "", fmt.Errorf("invalid avatar object key")
	}
	signedURL, err := storage.client.Object.GetPresignedURL(
		ctx,
		http.MethodGet,
		objectKey,
		storage.secretID,
		storage.secretKey,
		24*time.Hour,
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("sign avatar URL: %w", err)
	}
	return signedURL.String(), nil
}

func (storage *COSStorage) SignedProfileBackgroundURL(ctx context.Context, objectKey string) (string, error) {
	if !storage.IsProfileBackgroundKey(objectKey) {
		return "", fmt.Errorf("invalid profile background object key")
	}
	signedURL, err := storage.client.Object.GetPresignedURL(
		ctx,
		http.MethodGet,
		objectKey,
		storage.secretID,
		storage.secretKey,
		24*time.Hour,
		nil,
	)
	if err != nil {
		return "", fmt.Errorf("sign profile background URL: %w", err)
	}
	return signedURL.String(), nil
}

func (storage *COSStorage) DeleteAvatar(ctx context.Context, objectKey string) error {
	if !storage.IsAvatarKey(objectKey) {
		return nil
	}
	if _, err := storage.client.Object.Delete(ctx, objectKey); err != nil {
		return fmt.Errorf("delete avatar from COS: %w", err)
	}
	return nil
}

func (storage *COSStorage) DeleteProfileBackground(ctx context.Context, objectKey string) error {
	if !storage.IsProfileBackgroundKey(objectKey) {
		return nil
	}
	if _, err := storage.client.Object.Delete(ctx, objectKey); err != nil {
		return fmt.Errorf("delete profile background from COS: %w", err)
	}
	return nil
}

func (storage *COSStorage) IsAvatarKey(objectKey string) bool {
	return strings.HasPrefix(objectKey, storage.avatarPrefix) && !strings.Contains(objectKey, "..")
}

func (storage *COSStorage) IsProfileBackgroundKey(objectKey string) bool {
	return strings.HasPrefix(objectKey, storage.avatarPrefix) && !strings.Contains(objectKey, "..")
}

func AvatarExtension(contentType string) (string, bool) {
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
