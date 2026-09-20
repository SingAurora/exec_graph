package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func TestProcessAvatarResizesAndEncodesJPEG(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 1600, 900))
	for y := 0; y < 900; y++ {
		for x := 0; x < 1600; x++ {
			source.SetRGBA(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 180, A: 255})
		}
	}
	var input bytes.Buffer
	if err := jpeg.Encode(&input, source, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatalf("encode source: %v", err)
	}
	compressed, err := (ProfileImageProcessor{}).ProcessAvatar(input.Bytes())
	if err != nil {
		t.Fatalf("process avatar: %v", err)
	}
	if len(compressed) > maxStoredAvatarBytes {
		t.Fatalf("compressed avatar size = %d, want <= %d", len(compressed), maxStoredAvatarBytes)
	}
	output, format, err := image.Decode(bytes.NewReader(compressed))
	if err != nil {
		t.Fatalf("decode compressed avatar: %v", err)
	}
	if format != "jpeg" || output.Bounds().Dx() > maxAvatarDimension || output.Bounds().Dy() > maxAvatarDimension {
		t.Fatalf("unexpected avatar output: format=%s dimensions=%dx%d", format, output.Bounds().Dx(), output.Bounds().Dy())
	}
}
