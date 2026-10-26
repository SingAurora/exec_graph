package media

import (
	"bytes"
	"crypto/sha256"
	"image"
	_ "image/jpeg"
	_ "image/png"

	_ "golang.org/x/image/webp"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func inspect(body []byte) (Upload, string, error) {
	var out Upload
	if len(body) == 0 || len(body) > constants.MaxImageBytes {
		return out, "", fault.New(fault.Invalid, "图片不能为空，且不能超过 8 MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(body))
	mime := map[string]string{"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[format]
	if err != nil || mime == "" {
		return out, "", fault.New(fault.Invalid, "请选择有效的 JPEG、PNG 或 WebP 图片")
	}
	if config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > constants.MaxImagePixels {
		return out, "", fault.New(fault.Invalid, "图片不能超过 2000 万像素")
	}
	if _, _, err := image.Decode(bytes.NewReader(body)); err != nil {
		return out, "", fault.New(fault.Invalid, "图片内容损坏，无法读取")
	}
	digest := sha256.Sum256(body)
	out.MIMEType, out.ByteSize = mime, uint64(len(body))
	out.Width, out.Height, out.SHA256 = uint32(config.Width), uint32(config.Height), digest[:]
	return out, format, nil
}
