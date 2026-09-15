package mysql

import "gorm.io/gorm/clause"

var clauseForUpdate = clause.Locking{Strength: "UPDATE"}
