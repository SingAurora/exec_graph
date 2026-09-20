// Package media implements image validation and transformation for application use cases.
package media

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	stdDraw "image/draw"
	"image/jpeg"
	_ "image/png"
	"net/http"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	maxAvatarDimension   = 512
	maxStoredAvatarBytes = 300 * 1024
	maxBackgroundWidth   = 1600
	maxBackgroundHeight  = 640
	maxStoredBackground  = 700 * 1024
)

// ProfileImageProcessor 将受支持的个人资料图片转换为受控尺寸的 JPEG。
type ProfileImageProcessor struct{}

// ProcessAvatar 校验并压缩头像。
func (ProfileImageProcessor) ProcessAvatar(contents []byte) ([]byte, error) {
	if !supportedImage(contents) {
		return nil, fmt.Errorf("unsupported avatar image")
	}
	source, _, err := image.Decode(bytes.NewReader(contents))
	if err != nil {
		return nil, fmt.Errorf("decode avatar: %w", err)
	}
	bounds := source.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return nil, fmt.Errorf("invalid avatar dimensions")
	}
	for dimension := maxAvatarDimension; dimension >= 128; dimension /= 2 {
		width, height := resizeDimensions(bounds.Dx(), bounds.Dy(), dimension, dimension)
		if output, ok, err := encodeJPEG(source, bounds, width, height, maxStoredAvatarBytes, []int{82, 72, 62, 52}); err != nil {
			return nil, err
		} else if ok {
			return output, nil
		}
	}
	return nil, fmt.Errorf("compressed avatar is too large")
}

// ProcessBackground 校验并压缩主页背景图。
func (ProfileImageProcessor) ProcessBackground(contents []byte) ([]byte, error) {
	if !supportedImage(contents) {
		return nil, fmt.Errorf("unsupported background image")
	}
	source, _, err := image.Decode(bytes.NewReader(contents))
	if err != nil {
		return nil, fmt.Errorf("decode profile background: %w", err)
	}
	bounds := source.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return nil, fmt.Errorf("invalid profile background dimensions")
	}
	width, height := resizeDimensions(bounds.Dx(), bounds.Dy(), maxBackgroundWidth, maxBackgroundHeight)
	output, ok, err := encodeJPEG(source, bounds, width, height, maxStoredBackground, []int{86, 78, 70, 62})
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("compressed profile background is too large")
	}
	return output, nil
}

func supportedImage(contents []byte) bool {
	switch http.DetectContentType(contents) {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func encodeJPEG(source image.Image, bounds image.Rectangle, width, height, maxBytes int, qualities []int) ([]byte, bool, error) {
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	stdDraw.Draw(canvas, canvas.Bounds(), image.NewUniform(color.White), image.Point{}, stdDraw.Src)
	xdraw.CatmullRom.Scale(canvas, canvas.Bounds(), source, bounds, stdDraw.Over, nil)
	for _, quality := range qualities {
		var output bytes.Buffer
		if err := jpeg.Encode(&output, canvas, &jpeg.Options{Quality: quality}); err != nil {
			return nil, false, fmt.Errorf("encode profile image: %w", err)
		}
		if output.Len() <= maxBytes {
			return output.Bytes(), true, nil
		}
	}
	return nil, false, nil
}

func resizeDimensions(width, height, maxWidth, maxHeight int) (int, int) {
	if width <= maxWidth && height <= maxHeight {
		return width, height
	}
	widthRatio := float64(maxWidth) / float64(width)
	heightRatio := float64(maxHeight) / float64(height)
	ratio := min(widthRatio, heightRatio)
	return max(1, int(float64(width)*ratio)), max(1, int(float64(height)*ratio))
}
