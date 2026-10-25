// Package id 提供公开 UUID 和演示导入的稳定身份映射。
package id

import (
	"crypto/rand"
	"crypto/sha1"
	"encoding/hex"
	"regexp"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// Valid 检查服务端规范化的小写 UUID。
func Valid(value string) bool { return uuidPattern.MatchString(value) }

// New 生成随机 UUID v4。
func New() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		panic("系统随机数不可用")
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	return format(bytes[:])
}

// Demo 仅为固定测试数据生成 UUID v5，不能用于新业务资源。
func Demo(kind, alias string) string {
	namespace, _ := hex.DecodeString("6ba7b8109dad11d180b400c04fd430c8")
	hash := sha1.New()
	_, _ = hash.Write(namespace)
	_, _ = hash.Write([]byte("exec-graph/demo/v1/" + kind + "/" + alias))
	bytes := hash.Sum(nil)[:16]
	bytes[6] = (bytes[6] & 0x0f) | 0x50
	bytes[8] = (bytes[8] & 0x3f) | 0x80
	return format(bytes)
}

func format(bytes []byte) string {
	text := hex.EncodeToString(bytes)
	return text[:8] + "-" + text[8:12] + "-" + text[12:16] + "-" + text[16:20] + "-" + text[20:]
}
