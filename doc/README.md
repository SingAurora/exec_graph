# 文档索引

本目录只保留当前仍需维护的契约、提示词和本地演示信息。历史设计、实施日志和过期问题清单已删除，代码、测试和迁移是实现的最终依据。

| 文档 | 用途 | 维护方式 |
| --- | --- | --- |
| [product-positioning.md](product-positioning.md) | 产品定位、目标用户、核心循环和取舍原则 | 产品方向变化时同步 |
| [api-request-contract.md](api-request-contract.md) | 前后端请求边界、路由、查询和客户端约定 | 接口或交互变化时同步 |
| [backend-write-contract.md](backend-write-contract.md) | 发布、图、行动、表达和约定的写入规则 | 事务、权限、DTO 变化时同步 |
| [backend-external-contract.md](backend-external-contract.md) | 认证、图片、平台 AI、核验和外部能力 | 外部能力或 AI 流程变化时同步 |
| [prompt-inventory.md](prompt-inventory.md) | 生成与核验提示词、上下文快照、版本 | 修改 `rules.go` 时同步 |
| [test-accounts.local.md](test-accounts.local.md) | 演示账号信息 | 仅受控演示环境使用 |

阅读顺序：先看当前契约，再看对应代码和测试；旧设计文档不再作为实现依据。

## 本地开发

```sh
# 同时启动 Go API 和 Vite
./dev.sh

# 或分别启动
cd backend && go run ./cmd/api
cd frontend && bun install && bun run dev
```

默认后端 `127.0.0.1:8080`，前端 `127.0.0.1:5173`；Vite 将 `/api` 代理到后端。前后端固定同源部署，生产由 Go 直接提供 `frontend/dist`，不需要 Nginx 或 Vite。

## 验证

```sh
cd frontend
bun run lint
bun run test
bun run build

cd ../backend
go test ./...
go vet ./...
```

提交前运行 `git diff --check`。
