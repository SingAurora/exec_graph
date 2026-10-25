// Package constants 汇总跨用例使用的容量和超时。
package constants

import "time"

const (
	// IdempotencyRetention 是创建命令结果的最短保存时间。
	IdempotencyRetention = 24 * time.Hour
	// GraphTitleLimit 限制图名称字符数。
	GraphTitleLimit = 60
	// GraphDescriptionLimit 限制图简介字符数。
	GraphDescriptionLimit = 240
	// GraphEditorContributorLimit 是按行动贡献数量获得图资料编辑资格的人数。
	GraphEditorContributorLimit = 3
	// ContextGuideLimit 限制图级整理指引字符数。
	ContextGuideLimit = 4000
	// ProfileNameLimit 限制公开昵称字符数。
	ProfileNameLimit = 30
	// BiographyLimit 限制个人简介字符数。
	BiographyLimit = 1000
	// HighlightLimit 限制精选表达数量。
	HighlightLimit = 5
	// DocumentLimit 限制单份 Markdown 字符数。
	DocumentLimit = 100000
	// DirectSourceLimit 限制一次行动采用的直接来源数量。
	DirectSourceLimit = 50
	// ActionImageLimit 限制行动配图数量。
	ActionImageLimit = 12
	// ImageAltLimit 限制图片描述字符数。
	ImageAltLimit = 500
	// ActionTitleLimit 限制生成的行动标题字符数。
	ActionTitleLimit = 200
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
