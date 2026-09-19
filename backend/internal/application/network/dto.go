package network

import "time"

// Node 是执行网络中的人物或项目节点。
type Node struct {
	ID            string `json:"id"`
	Kind          string `json:"kind"`
	Label         string `json:"label"`
	Detail        string `json:"detail"`
	ProjectID     string `json:"projectId,omitempty"`
	RecordID      string `json:"recordId,omitempty"`
	UserID        string `json:"userId,omitempty"`
	Weight        int    `json:"weight"`
	HasOpenCall   bool   `json:"hasOpenCall"`
	IsCurrentUser bool   `json:"isCurrentUser"`
}

// Edge 是执行网络中两个节点之间的可追溯关系。
type Edge struct {
	ID                 string    `json:"id"`
	Source             string    `json:"source"`
	Target             string    `json:"target"`
	Type               string    `json:"type"`
	Label              string    `json:"label"`
	Detail             string    `json:"detail,omitempty"`
	RecordID           string    `json:"recordId,omitempty"`
	CallID             string    `json:"callId,omitempty"`
	SourceProjectID    string    `json:"sourceProjectId,omitempty"`
	TargetProjectID    string    `json:"targetProjectId,omitempty"`
	SourceProjectTitle string    `json:"sourceProjectTitle,omitempty"`
	TargetProjectTitle string    `json:"targetProjectTitle,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
}

// Graph 是执行网络的完整查询结果。
type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}
