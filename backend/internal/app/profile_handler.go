package app

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"image"
	"image/color"
	stdDraw "image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	maxAvatarUploadBytes = 2 * 1024 * 1024
	maxAvatarBodyBytes   = maxAvatarUploadBytes + 128*1024
	maxAvatarDimension   = 512
	maxStoredAvatarBytes = 300 * 1024
)

type userProfileResponse struct {
	ID        uint64  `json:"id"`
	Username  string  `json:"username"`
	Email     string  `json:"email"`
	Bio       string  `json:"bio"`
	Gender    string  `json:"gender"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
}

func (s *server) handleCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	profile, err := s.loadUserProfile(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取个人资料失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}

func (s *server) handleAvatar(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	switch r.Method {
	case http.MethodPost:
		s.uploadAvatar(w, r, user)
	case http.MethodDelete:
		s.deleteAvatar(w, r, user)
	default:
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
	}
}

func (s *server) uploadAvatar(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
	if s.storage == nil {
		writeError(w, http.StatusServiceUnavailable, "头像存储暂不可用")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBodyBytes)
	if err := r.ParseMultipartForm(maxAvatarBodyBytes); err != nil {
		writeError(w, http.StatusBadRequest, "头像文件不能超过 2 MB")
		return
	}
	file, _, err := r.FormFile("avatar")
	if err != nil {
		writeError(w, http.StatusBadRequest, "请选择头像文件")
		return
	}
	defer file.Close()
	contents, err := io.ReadAll(io.LimitReader(file, maxAvatarUploadBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "读取头像文件失败")
		return
	}
	if len(contents) == 0 || len(contents) > maxAvatarUploadBytes {
		writeError(w, http.StatusBadRequest, "头像文件不能超过 2 MB")
		return
	}
	contentType := http.DetectContentType(contents)
	if _, ok := avatarExtension(contentType); !ok {
		writeError(w, http.StatusBadRequest, "头像仅支持 PNG、JPEG 或 WebP 格式")
		return
	}
	compressedContents, err := compressAvatar(contents)
	if err != nil {
		writeError(w, http.StatusBadRequest, "头像处理失败，请更换一张 PNG、JPEG 或 WebP 图片")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	oldObjectKey, err := s.loadAvatarObjectKey(ctx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当前头像失败")
		return
	}
	newObjectKey, avatarURL, err := s.storage.putAvatar(ctx, user.ID, "image/jpeg", compressedContents)
	if err != nil {
		log.Printf("upload avatar for user %d failed: %v", user.ID, err)
		writeError(w, http.StatusBadGateway, "头像上传失败，请稍后重试")
		return
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE users SET avatar_url = ? WHERE id = ?`, newObjectKey, user.ID); err != nil {
		_ = s.storage.deleteAvatar(ctx, newObjectKey)
		writeError(w, http.StatusInternalServerError, "保存头像失败")
		return
	}
	if oldObjectKey != "" && oldObjectKey != newObjectKey {
		if err := s.storage.deleteAvatar(ctx, oldObjectKey); err != nil {
			log.Printf("delete previous avatar for user %d failed: %v", user.ID, err)
		}
	}
	writeJSON(w, http.StatusCreated, map[string]string{"avatarUrl": avatarURL})
}

func compressAvatar(contents []byte) ([]byte, error) {
	source, _, err := image.Decode(bytes.NewReader(contents))
	if err != nil {
		return nil, fmt.Errorf("decode avatar: %w", err)
	}
	bounds := source.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return nil, fmt.Errorf("invalid avatar dimensions")
	}

	maxDimension := maxAvatarDimension
	for maxDimension >= 128 {
		targetWidth, targetHeight := resizeAvatarDimensions(bounds.Dx(), bounds.Dy(), maxDimension)
		canvas := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
		stdDraw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.White), image.Point{}, stdDraw.Src)
		xdraw.CatmullRom.Scale(canvas, canvas.Bounds(), source, bounds, stdDraw.Over, nil)
		for _, quality := range []int{82, 72, 62, 52} {
			var output bytes.Buffer
			if err := jpeg.Encode(&output, canvas, &jpeg.Options{Quality: quality}); err != nil {
				return nil, fmt.Errorf("encode avatar: %w", err)
			}
			if output.Len() <= maxStoredAvatarBytes {
				return output.Bytes(), nil
			}
		}
		maxDimension /= 2
	}
	return nil, fmt.Errorf("compressed avatar is too large")
}

func resizeAvatarDimensions(width, height, maxDimension int) (int, int) {
	if width <= maxDimension && height <= maxDimension {
		return width, height
	}
	if width >= height {
		return maxDimension, max(1, height*maxDimension/width)
	}
	return max(1, width*maxDimension/height), maxDimension
}

func (s *server) deleteAvatar(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
	if s.storage == nil {
		writeError(w, http.StatusServiceUnavailable, "头像存储暂不可用")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	objectKey, err := s.loadAvatarObjectKey(ctx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当前头像失败")
		return
	}
	if objectKey == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE users SET avatar_url = NULL WHERE id = ?`, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "移除头像失败")
		return
	}
	if err := s.storage.deleteAvatar(ctx, objectKey); err != nil {
		log.Printf("delete avatar for user %d failed: %v", user.ID, err)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) loadUserProfile(requestContext context.Context, userID uint64) (userProfileResponse, error) {
	ctx, cancel := context.WithTimeout(requestContext, 8*time.Second)
	defer cancel()
	var profile userProfileResponse
	var bio, gender, avatarObjectKey sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, username, email, bio, gender, avatar_url
		FROM users WHERE id = ?`, userID).
		Scan(&profile.ID, &profile.Username, &profile.Email, &bio, &gender, &avatarObjectKey)
	if err != nil {
		return profile, err
	}
	if bio.Valid {
		profile.Bio = bio.String
	}
	if gender.Valid {
		profile.Gender = gender.String
	}
	if avatarObjectKey.Valid && avatarObjectKey.String != "" && s.storage != nil && s.storage.isAvatarKey(avatarObjectKey.String) {
		avatarURL, err := s.storage.signedAvatarURL(ctx, avatarObjectKey.String)
		if err != nil {
			return profile, fmt.Errorf("sign avatar URL: %w", err)
		}
		profile.AvatarURL = &avatarURL
	}
	return profile, nil
}

func (s *server) loadAvatarObjectKey(ctx context.Context, userID uint64) (string, error) {
	var objectKey sql.NullString
	if err := s.db.QueryRowContext(ctx, `SELECT avatar_url FROM users WHERE id = ?`, userID).Scan(&objectKey); err != nil {
		return "", err
	}
	if !objectKey.Valid || !strings.HasPrefix(objectKey.String, s.storage.avatarPrefix) {
		return "", nil
	}
	return objectKey.String, nil
}
