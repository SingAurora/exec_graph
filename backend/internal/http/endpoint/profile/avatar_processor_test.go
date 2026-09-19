package profile

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

func TestCompressAvatarResizesAndEncodesJPEG(t *testing.T) {
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

	compressed, err := compressAvatar(input.Bytes())
	if err != nil {
		t.Fatalf("compress avatar: %v", err)
	}
	if len(compressed) > maxStoredAvatarBytes {
		t.Fatalf("compressed avatar size = %d, want <= %d", len(compressed), maxStoredAvatarBytes)
	}
	output, format, err := image.Decode(bytes.NewReader(compressed))
	if err != nil {
		t.Fatalf("decode compressed avatar: %v", err)
	}
	if format != "jpeg" {
		t.Fatalf("format = %q, want jpeg", format)
	}
	if output.Bounds().Dx() > maxAvatarDimension || output.Bounds().Dy() > maxAvatarDimension {
		t.Fatalf("compressed avatar dimensions = %dx%d, want both <= %d", output.Bounds().Dx(), output.Bounds().Dy(), maxAvatarDimension)
	}
}

func TestAvatarExtension(t *testing.T) {
	tests := []struct {
		contentType string
		want        string
		valid       bool
	}{
		{contentType: "image/jpeg", want: ".jpg", valid: true},
		{contentType: "image/png", want: ".png", valid: true},
		{contentType: "image/webp", want: ".webp", valid: true},
		{contentType: "image/gif", valid: false},
		{contentType: "application/octet-stream", valid: false},
	}
	for _, test := range tests {
		got, valid := avatarExtension(test.contentType)
		if valid != test.valid || got != test.want {
			t.Fatalf("avatarExtension(%q) = (%q, %t), want (%q, %t)", test.contentType, got, valid, test.want, test.valid)
		}
	}
}
