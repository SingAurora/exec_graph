package constants

import "time"

// DatabasePingTimeout bounds the connectivity check performed while opening
// the database connection.
const DatabasePingTimeout = 8 * time.Second

// DatabaseOperationTimeout bounds the database-backed work performed by a
// regular HTTP request.
const DatabaseOperationTimeout = 8 * time.Second

// StartupInitializationTimeout bounds database migrations and required system
// data initialization before the HTTP server starts accepting requests.
const StartupInitializationTimeout = 10 * time.Second

// HTTPReadHeaderTimeout limits how long a client may take to send HTTP
// request headers before the server closes the connection.
const HTTPReadHeaderTimeout = 10 * time.Second
