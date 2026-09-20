package publicprofile

import (
	"context"
	"testing"
	"time"
)

type repositoryStub struct {
	loadedUserID string
	user         User
	projects     []Project
	records      []Completion
	err          error
}

type objectURLSignerStub struct{}

func (objectURLSignerStub) SignedObjectURL(_ context.Context, objectKey string, _ time.Duration) (string, error) {
	return "https://media.example/" + objectKey, nil
}

func (objectURLSignerStub) IsManagedObjectKey(objectKey string) bool { return objectKey != "" }

func (repository *repositoryStub) Load(_ context.Context, userID string) (User, []Project, []Completion, error) {
	repository.loadedUserID = userID
	return repository.user, repository.projects, repository.records, repository.err
}

func TestGetPublicProfileNormalizesUserIDAndCountsDistinctActiveDays(t *testing.T) {
	repository := &repositoryStub{
		user:     User{Username: "林舟", UserID: "demo-linzhou", AvatarObjectKey: "avatars/linzhou.jpg", ProfileBackgroundKey: "backgrounds/linzhou.jpg"},
		projects: []Project{{UUID: "project-1", Title: "公开项目"}},
		records: []Completion{
			{UUID: "record-1", CreatedAt: time.Date(2026, 9, 20, 8, 0, 0, 0, time.UTC)},
			{UUID: "record-2", CreatedAt: time.Date(2026, 9, 20, 18, 0, 0, 0, time.UTC)},
			{UUID: "record-3", CreatedAt: time.Date(2026, 9, 21, 8, 0, 0, 0, time.UTC)},
		},
	}

	profile, err := New(Dependencies{Repository: repository, Storage: objectURLSignerStub{}}).GetPublicProfile(context.Background(), "  @demo-linzhou  ")
	if err != nil {
		t.Fatalf("GetPublicProfile returned error: %v", err)
	}
	if repository.loadedUserID != "demo-linzhou" {
		t.Fatalf("repository user ID = %q, want %q", repository.loadedUserID, "demo-linzhou")
	}
	if profile.User.UserID != "demo-linzhou" || len(profile.Projects) != 1 || len(profile.Records) != 3 {
		t.Fatalf("unexpected profile: %+v", profile)
	}
	if profile.ActiveDays != 2 {
		t.Fatalf("active days = %d, want 2", profile.ActiveDays)
	}
	if profile.User.AvatarURL != "https://media.example/avatars/linzhou.jpg" || profile.User.ProfileBackgroundURL != "https://media.example/backgrounds/linzhou.jpg" {
		t.Fatalf("unexpected signed media URLs: %+v", profile.User)
	}
}

func TestGetPublicProfileRejectsUnsafeUserID(t *testing.T) {
	repository := &repositoryStub{}
	_, err := New(Dependencies{Repository: repository}).GetPublicProfile(context.Background(), "../../users")
	if err != ErrInvalidUserID {
		t.Fatalf("error = %v, want %v", err, ErrInvalidUserID)
	}
	if repository.loadedUserID != "" {
		t.Fatal("repository should not be called for an invalid user ID")
	}
}
