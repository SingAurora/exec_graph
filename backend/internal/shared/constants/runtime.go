// Package constants 汇总跨用例使用的容量和超时。
package constants

import "time"

const (
	// DependencyTimeout 限制启动探测和数据库连接等待。
	DependencyTimeout = 5 * time.Second
	// HTTPHeaderTimeout 限制请求头等待。
	HTTPHeaderTimeout = 5 * time.Second
	// HTTPRequestTimeout 限制普通业务请求读取。
	HTTPRequestTimeout = 30 * time.Second
	// ShutdownTimeout 限制退出等待。
	ShutdownTimeout = 10 * time.Second
	// MaxJSONBytes 限制单次 JSON 请求容量。
	MaxJSONBytes = 1 << 20
	// PasswordMemoryKiB 是 Argon2id 的内存成本。
	PasswordMemoryKiB = 64 * 1024
	// PasswordIterations 是 Argon2id 的时间成本。
	PasswordIterations = 3
	// PasswordParallelism 是 Argon2id 的并行度。
	PasswordParallelism = 2
	// LatestSchemaVersion 是当前应用要求的迁移版本。
	LatestSchemaVersion uint64 = 1
)
