package app

import "testing"

func TestSeedDemoDataRequiresExplicitConfirmation(t *testing.T) {
	t.Setenv("EXEC_GRAPH_ALLOW_DEMO_SEED", "")
	if err := SeedDemoData(); err == nil {
		t.Fatal("SeedDemoData() succeeded without EXEC_GRAPH_ALLOW_DEMO_SEED")
	}
}
