package media

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/gif"
	"image/png"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestInspectValidatesActualImageAndDecodedSize(t *testing.T) {
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 3, 2))); err != nil {
		t.Fatal(err)
	}
	body := encoded.Bytes()
	upload, format, err := inspect(body)
	if err != nil || format != "png" || upload.MIMEType != "image/png" || upload.Width != 3 || upload.Height != 2 || len(upload.SHA256) != 32 {
		t.Fatalf("有效图片识别失败: %+v %s %v", upload, format, err)
	}
	large := append([]byte{}, body...)
	binary.BigEndian.PutUint32(large[16:20], 100_000)
	binary.BigEndian.PutUint32(large[20:24], 100_000)
	binary.BigEndian.PutUint32(large[29:33], crc32.ChecksumIEEE(large[12:29]))
	var animation bytes.Buffer
	if err := gif.Encode(&animation, image.NewRGBA(image.Rect(0, 0, 1, 1)), nil); err != nil {
		t.Fatal(err)
	}
	for name, invalid := range map[string][]byte{"html": []byte("<html>not an image</html>"), "empty": {}, "oversize": make([]byte, constants.MaxImageBytes+1), "truncated": body[:len(body)/2], "pixel-bomb": large, "gif": animation.Bytes()} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := inspect(invalid); err == nil {
				t.Fatal("无效图片未被拒绝")
			}
		})
	}
}
