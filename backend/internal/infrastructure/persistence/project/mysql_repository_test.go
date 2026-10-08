package project

import (
	"strings"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func newDryRunDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(mysql.New(mysql.Config{
		DriverName:                "mysql",
		DSN:                       "",
		SkipInitializeWithVersion: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true})
	if err != nil {
		t.Fatalf("open dry-run database: %v", err)
	}
	return db
}

func TestProjectRecordsWriteTheirOwnUUID(t *testing.T) {
	db := newDryRunDB(t)

	projectSQL := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Create(&Project{UUID: "project-uuid", OwnerID: 42, Title: "测试项目"})
	})
	if !strings.Contains(projectSQL, "`uuid`") {
		t.Fatalf("project INSERT does not include its own uuid: %s", projectSQL)
	}

	revisionSQL := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx.Create(&ProjectContractRevision{
			UUID:              "revision-uuid",
			ProjectID:         1,
			SmartContractID:   2,
			SmartContractUUID: "smart-contract-uuid",
		})
	})
	if !strings.Contains(revisionSQL, "`uuid`") {
		t.Fatalf("revision INSERT does not include its own uuid: %s", revisionSQL)
	}
	if strings.Contains(revisionSQL, "smart_contract_uuid") || strings.Contains(revisionSQL, "smart_contract_source") || strings.Contains(revisionSQL, "smart_contract_created_at") {
		t.Fatalf("revision INSERT includes read-only projection columns: %s", revisionSQL)
	}
}
