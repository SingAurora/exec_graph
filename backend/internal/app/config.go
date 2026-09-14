package app

import bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"

// Aliases keep the application boundary stable while configuration lives in
// the bootstrap layer instead of the HTTP and business packages.
type Config = bootstrapconfig.Config
type AppConfig = bootstrapconfig.AppConfig
type DatabaseConfig = bootstrapconfig.DatabaseConfig
type RedisConfig = bootstrapconfig.RedisConfig
type TencentConfig = bootstrapconfig.TencentConfig
type SESConfig = bootstrapconfig.SESConfig
type COSConfig = bootstrapconfig.COSConfig
type DevelopmentConfig = bootstrapconfig.DevelopmentConfig
type TestAccountConfig = bootstrapconfig.TestAccountConfig

func loadConfig(path string) (Config, error) { return bootstrapconfig.Load(path) }
