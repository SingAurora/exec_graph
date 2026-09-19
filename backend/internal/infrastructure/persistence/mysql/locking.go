package mysql

import "gorm.io/gorm/clause"

// ForUpdate 让业务仓储在事务中显式声明需要的行锁。
var ForUpdate = clause.Locking{Strength: "UPDATE"}
