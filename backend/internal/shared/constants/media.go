package constants

import "time"

const (
	// MaxImageBytes 限制单张原图上传和读取大小。
	MaxImageBytes = 8 << 20
	// MaxImagePixels 限制解码后的内存规模。
	MaxImagePixels = 20_000_000
	// MultipartOverhead 为 multipart 边界与文件头预留空间。
	MultipartOverhead = 64 << 10
	// UnusedMediaRetention 为未保存的上传保留一天。
	UnusedMediaRetention = 24 * time.Hour
	// DraftMediaRetention 从最后一次显式草稿续期保留七天。
	DraftMediaRetention = 7 * 24 * time.Hour
	// MediaCleanupInterval 是进程内清理扫描间隔。
	MediaCleanupInterval = time.Hour
	// MediaRetryDelay 限制对象删除失败的重试频率。
	MediaRetryDelay = 5 * time.Minute
	// MediaCleanupBatch 限制一轮清理的候选数量。
	MediaCleanupBatch = 100
	// MediaOperationTimeout 限制单次对象存储请求。
	MediaOperationTimeout = 20 * time.Second
)
