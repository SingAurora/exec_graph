package constants

import "time"

// DatabasePingTimeout bounds the connectivity check performed while opening
// the database connection.
const DatabasePingTimeout = 8 * time.Second

// DatabaseOperationTimeout bounds the database-backed work performed by a
// regular HTTP request.
const DatabaseOperationTimeout = 8 * time.Second
