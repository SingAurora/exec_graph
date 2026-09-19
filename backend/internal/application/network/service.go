// Package network provides the public execution-network read use case.
package network

import (
	"context"
	"time"
)

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

type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

// Repository hides persistence and query implementation from the use case.
type Repository interface {
	Load(ctx context.Context, currentUserID *uint64) (Graph, error)
}

type Service struct{ repository Repository }

func New(repository Repository) *Service { return &Service{repository: repository} }

func (s *Service) Explore(ctx context.Context, currentUserID *uint64) (Graph, error) {
	return s.repository.Load(ctx, currentUserID)
}
