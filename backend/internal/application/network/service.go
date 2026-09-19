// Package network provides the public execution-network read use case.
package network

import (
	"context"
)

// Repository hides persistence and query implementation from the use case.
type Repository interface {
	Load(ctx context.Context, currentUserID *uint64) (Graph, error)
}

type Service struct{ repository Repository }

func New(repository Repository) *Service { return &Service{repository: repository} }

func (s *Service) Explore(ctx context.Context, currentUserID *uint64) (Graph, error) {
	return s.repository.Load(ctx, currentUserID)
}
