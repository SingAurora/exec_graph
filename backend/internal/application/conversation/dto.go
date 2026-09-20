package conversation

import "time"

// Message 是规划对话中可复制到执行节点的消息视图。
type Message struct {
	ID        string
	Speaker   string
	Body      string
	CreatedAt time.Time
}
