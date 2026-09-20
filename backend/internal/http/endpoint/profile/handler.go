package profile

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	stdDraw "image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	maxAvatarUploadBytes = 2 * 1024 * 1024
	maxAvatarBodyBytes   = maxAvatarUploadBytes + 128*1024
	maxAvatarDimension   = 512
	maxStoredAvatarBytes = 300 * 1024

	maxProfileBackgroundUploadBytes = 2 * 1024 * 1024
	maxProfileBackgroundBodyBytes   = maxProfileBackgroundUploadBytes + 128*1024
	maxProfileBackgroundWidth       = 1600
	maxProfileBackgroundHeight      = 640
	maxStoredProfileBackgroundBytes = 700 * 1024
)

type userProfileResponse struct {
	ID                    uint64  `json:"id"`
	Username              string  `json:"username"`
	UserID                string  `json:"userId"`
	Email                 string  `json:"email"`
	Bio                   string  `json:"bio"`
	Gender                string  `json:"gender"`
	AvatarURL             *string `json:"avatarUrl,omitempty"`
	ProfileBackgroundURL  *string `json:"profileBackgroundUrl,omitempty"`
	CustomProfileEnabled  bool    `json:"customProfileEnabled"`
	CustomProfileMarkdown string  `json:"customProfileMarkdown"`
}

type updateUserProfileRequest struct {
	Username              string `json:"username"`
	UserID                string `json:"userId"`
	Bio                   string `json:"bio"`
	Gender                string `json:"gender"`
	CustomProfileEnabled  bool   `json:"customProfileEnabled"`
	CustomProfileMarkdown string `json:"customProfileMarkdown"`
}

func (h *Handler) CurrentUser(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	profile, err := h.loadUserProfile(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取个人资料失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}

func (h *Handler) UpdateCurrentUser(w http.ResponseWriter, r *http.Request, user applicationidentity.User) {
	var request updateUserProfileRequest
	if !bindJSON(w, r, &request) {
		return
	}
	username := strings.TrimSpace(request.Username)
	userID, err := normalizeUserID(request.UserID)
	if len([]rune(username)) < 2 || len([]rune(username)) > 64 {
		writeError(w, http.StatusBadRequest, "用户名长度需要在 2 到 64 个字符之间")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	bio := strings.TrimSpace(request.Bio)
	if len([]rune(bio)) > 120 {
		writeError(w, http.StatusBadRequest, "个人说明最多 120 个字符")
		return
	}
	customProfileMarkdown := strings.TrimSpace(request.CustomProfileMarkdown)
	if len([]rune(customProfileMarkdown)) > 20000 {
		writeError(w, http.StatusBadRequest, "自定义主页最多 20000 个字符")
		return
	}
	if request.Gender != "female" && request.Gender != "male" && request.Gender != "undisclosed" {
		writeError(w, http.StatusBadRequest, "性别选项不正确")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err = h.identity.UpdateProfile(ctx, user.ID, applicationidentity.UpdateProfileInput{Username: username, UserID: userID, Bio: bio, Gender: request.Gender, CustomProfileEnabled: request.CustomProfileEnabled, CustomProfileMarkdown: customProfileMarkdown})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			writeError(w, http.StatusConflict, "该用户 ID 已被使用")
			return
		}
		writeError(w, http.StatusInternalServerError, "保存个人资料失败")
		return
	}
	profile, err := h.loadUserProfile(ctx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取个人资料失败")
		return
	}
	if err := h.cacheSession(r.Context(), bearerToken(r), applicationidentity.User{ID: user.ID, Username: profile.Username, UserID: profile.UserID, Email: user.Email}); err != nil {
		writeError(w, http.StatusServiceUnavailable, "个人资料已保存，但 Redis 登录会话暂时不可用，请稍后重试")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": profile})
}

func (h *Handler) Avatar(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	h.uploadAvatar(w, r, user)
}

func (h *Handler) ProfileBackground(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	h.uploadProfileBackground(w, r, user)
}

func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request, user applicationidentity.User) {
	if h.storage == nil {
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

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ProfileMediaTimeout)
	defer cancel()
	oldObjectKey, err := h.loadAvatarObjectKey(ctx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当前头像失败")
		return
	}
	newObjectKey, err := newProfileObjectKey(h.storage, user.ID, "avatar")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成头像对象地址失败")
		return
	}
	if err := h.storage.PutObject(ctx, newObjectKey, "image/jpeg", compressedContents, "private, max-age=86400"); err != nil {
		log.Printf("upload avatar for user %d failed: %v", user.ID, err)
		writeError(w, http.StatusBadGateway, "头像上传失败，请稍后重试")
		return
	}
	avatarURL, err := h.storage.SignedObjectURL(ctx, newObjectKey, 24*time.Hour)
	if err != nil {
		log.Printf("upload avatar for user %d failed: %v", user.ID, err)
		_ = h.storage.DeleteObject(ctx, newObjectKey)
		writeError(w, http.StatusBadGateway, "头像上传失败，请稍后重试")
		return
	}
	if err := h.identity.SetAvatarObjectKey(ctx, user.ID, newObjectKey); err != nil {
		_ = h.storage.DeleteObject(ctx, newObjectKey)
		writeError(w, http.StatusInternalServerError, "保存头像失败")
		return
	}
	if oldObjectKey != "" && oldObjectKey != newObjectKey {
		if err := h.storage.DeleteObject(ctx, oldObjectKey); err != nil {
			log.Printf("delete previous avatar for user %d failed: %v", user.ID, err)
		}
	}
	writeJSON(w, http.StatusCreated, map[string]string{"avatarUrl": avatarURL})
}

func (h *Handler) uploadProfileBackground(w http.ResponseWriter, r *http.Request, user applicationidentity.User) {
	if h.storage == nil {
		writeError(w, http.StatusServiceUnavailable, "背景图存储暂不可用")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxProfileBackgroundBodyBytes)
	if err := r.ParseMultipartForm(maxProfileBackgroundBodyBytes); err != nil {
		writeError(w, http.StatusBadRequest, "背景图片不能超过 2 MB")
		return
	}
	file, _, err := r.FormFile("background")
	if err != nil {
		writeError(w, http.StatusBadRequest, "请选择背景图片")
		return
	}
	defer file.Close()
	contents, err := io.ReadAll(io.LimitReader(file, maxProfileBackgroundUploadBytes+1))
	if err != nil {
		writeError(w, http.StatusBadRequest, "读取背景图片失败")
		return
	}
	if len(contents) == 0 || len(contents) > maxProfileBackgroundUploadBytes {
		writeError(w, http.StatusBadRequest, "背景图片不能超过 2 MB")
		return
	}
	contentType := http.DetectContentType(contents)
	if _, ok := avatarExtension(contentType); !ok {
		writeError(w, http.StatusBadRequest, "背景图片仅支持 PNG、JPEG 或 WebP 格式")
		return
	}
	compressedContents, err := compressProfileBackground(contents)
	if err != nil {
		writeError(w, http.StatusBadRequest, "背景图片处理失败，请更换一张 PNG、JPEG 或 WebP 图片")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ProfileMediaTimeout)
	defer cancel()
	oldObjectKey, err := h.loadProfileBackgroundObjectKey(ctx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取当前背景图失败")
		return
	}
	newObjectKey, err := newProfileObjectKey(h.storage, user.ID, "background")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成背景图对象地址失败")
		return
	}
	if err := h.storage.PutObject(ctx, newObjectKey, "image/jpeg", compressedContents, "private, max-age=86400"); err != nil {
		log.Printf("upload profile background for user %d failed: %v", user.ID, err)
		writeError(w, http.StatusBadGateway, "背景图片上传失败，请稍后重试")
		return
	}
	backgroundURL, err := h.storage.SignedObjectURL(ctx, newObjectKey, 24*time.Hour)
	if err != nil {
		log.Printf("upload profile background for user %d failed: %v", user.ID, err)
		_ = h.storage.DeleteObject(ctx, newObjectKey)
		writeError(w, http.StatusBadGateway, "背景图片上传失败，请稍后重试")
		return
	}
	if err := h.identity.SetProfileBackgroundObjectKey(ctx, user.ID, newObjectKey); err != nil {
		_ = h.storage.DeleteObject(ctx, newObjectKey)
		writeError(w, http.StatusInternalServerError, "保存背景图片失败")
		return
	}
	if oldObjectKey != "" && oldObjectKey != newObjectKey {
		if err := h.storage.DeleteObject(ctx, oldObjectKey); err != nil {
			log.Printf("delete previous profile background for user %d failed: %v", user.ID, err)
		}
	}
	writeJSON(w, http.StatusCreated, map[string]string{"profileBackgroundUrl": backgroundURL})
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

func compressProfileBackground(contents []byte) ([]byte, error) {
	source, _, err := image.Decode(bytes.NewReader(contents))
	if err != nil {
		return nil, fmt.Errorf("decode profile background: %w", err)
	}
	bounds := source.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return nil, fmt.Errorf("invalid profile background dimensions")
	}

	targetWidth, targetHeight := resizeProfileBackgroundDimensions(bounds.Dx(), bounds.Dy(), maxProfileBackgroundWidth, maxProfileBackgroundHeight)
	canvas := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	stdDraw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.White), image.Point{}, stdDraw.Src)
	xdraw.CatmullRom.Scale(canvas, canvas.Bounds(), source, bounds, stdDraw.Over, nil)
	for _, quality := range []int{86, 78, 70, 62} {
		var output bytes.Buffer
		if err := jpeg.Encode(&output, canvas, &jpeg.Options{Quality: quality}); err != nil {
			return nil, fmt.Errorf("encode profile background: %w", err)
		}
		if output.Len() <= maxStoredProfileBackgroundBytes {
			return output.Bytes(), nil
		}
	}
	return nil, fmt.Errorf("compressed profile background is too large")
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

func resizeProfileBackgroundDimensions(width, height, maxWidth, maxHeight int) (int, int) {
	if width <= maxWidth && height <= maxHeight {
		return width, height
	}
	widthRatio := float64(maxWidth) / float64(width)
	heightRatio := float64(maxHeight) / float64(height)
	ratio := min(widthRatio, heightRatio)
	return max(1, int(float64(width)*ratio)), max(1, int(float64(height)*ratio))
}

func (h *Handler) loadUserProfile(requestContext context.Context, userID uint64) (userProfileResponse, error) {
	ctx, cancel := context.WithTimeout(requestContext, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	stored, err := h.identity.GetProfile(ctx, userID)
	if err != nil {
		return userProfileResponse{}, err
	}
	profile := userProfileResponse{ID: stored.ID, Username: stored.Username, UserID: stored.UserID, Email: stored.Email, Bio: stored.Bio, Gender: stored.Gender, CustomProfileEnabled: stored.CustomProfileEnabled, CustomProfileMarkdown: stored.CustomProfileMarkdown}
	if stored.AvatarObjectKey != "" && h.storage != nil && h.storage.IsManagedObjectKey(stored.AvatarObjectKey) {
		avatarURL, err := h.storage.SignedObjectURL(ctx, stored.AvatarObjectKey, 24*time.Hour)
		if err != nil {
			return profile, fmt.Errorf("sign avatar URL: %w", err)
		}
		profile.AvatarURL = &avatarURL
	}
	if stored.ProfileBackgroundKey != "" && h.storage != nil && h.storage.IsManagedObjectKey(stored.ProfileBackgroundKey) {
		backgroundURL, err := h.storage.SignedObjectURL(ctx, stored.ProfileBackgroundKey, 24*time.Hour)
		if err != nil {
			return profile, fmt.Errorf("sign profile background URL: %w", err)
		}
		profile.ProfileBackgroundURL = &backgroundURL
	}
	return profile, nil
}

func (h *Handler) loadAvatarObjectKey(ctx context.Context, userID uint64) (string, error) {
	stored, err := h.identity.GetProfile(ctx, userID)
	if err != nil {
		return "", err
	}
	if stored.AvatarObjectKey == "" || !h.storage.IsManagedObjectKey(stored.AvatarObjectKey) {
		return "", nil
	}
	return stored.AvatarObjectKey, nil
}

func (h *Handler) loadProfileBackgroundObjectKey(ctx context.Context, userID uint64) (string, error) {
	stored, err := h.identity.GetProfile(ctx, userID)
	if err != nil {
		return "", err
	}
	if stored.ProfileBackgroundKey == "" || !h.storage.IsManagedObjectKey(stored.ProfileBackgroundKey) {
		return "", nil
	}
	return stored.ProfileBackgroundKey, nil
}

func avatarExtension(contentType string) (string, bool) {
	return infrastructurestorage.ImageExtension(contentType)
}

func newProfileObjectKey(storage infrastructurestorage.ObjectStorage, userID uint64, objectType string) (string, error) {
	name, err := sharedid.Opaque(objectType)
	if err != nil {
		return "", err
	}
	return storage.NewObjectKey(strconv.FormatUint(userID, 10), name+".jpg")
}
