package security

import "testing"

func TestPasswordHasher(t *testing.T) {
	hasher := PasswordHasher{}
	hash, err := hasher.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if hash == "correct horse battery staple" || !hasher.IsHash(hash) {
		t.Fatalf("Hash returned an invalid bcrypt value")
	}
	if !hasher.Verify(hash, "correct horse battery staple") {
		t.Fatal("Verify rejected the correct password")
	}
	if hasher.Verify(hash, "wrong password") {
		t.Fatal("Verify accepted a wrong password")
	}
}
