package schema

import (
	"gorm.io/gorm/schema"
	"sync"
	"testing"
)

func TestModelsHaveUUIDScalarsAndNoORMRelationships(t *testing.T) {
	cache := &sync.Map{}
	for _, m := range Models() {
		s, err := schema.Parse(m, cache, schema.NamingStrategy{})
		if err != nil {
			t.Fatal(err)
		}
		if len(s.Relationships.Relations) != 0 {
			t.Fatalf("%s 不应声明 ORM 关联", s.Table)
		}
		if len(s.PrimaryFields) != 1 || !s.PrimaryFields[0].AutoIncrement {
			t.Fatalf("%s 必须使用表内自增主键", s.Table)
		}
		for _, field := range s.Fields {
			if field.DBName == "uuid" || len(field.DBName) > 5 && field.DBName[len(field.DBName)-5:] == "_uuid" {
				if field.DataType != "char(36) CHARACTER SET ascii COLLATE ascii_bin" && field.DBName != "root_graph_uuid" {
					t.Fatalf("%s.%s UUID 类型不一致: %s", s.Table, field.DBName, field.DataType)
				}
			}
		}
	}
}
