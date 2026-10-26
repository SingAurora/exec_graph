# 引序后端

Go + Gin + GORM + MySQL + Redis。阶段安排和验收见 [实施计划](../doc/backend-implementation-plan.md)。

## 配置与管理

在 backend 目录运行，默认读取 `etc/config.local.yaml`。该文件包含旧项目凭据，已加入 gitignore；新能力通过无密钥示例和环境变量配置，不覆盖本地文件。

```sh
go run ./cmd/manage check
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage migrate --create-database
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage verify
```

`migrate` 是显式、有版本记录的 Go/GORM 迁移。首次迁移创建空表，已有未受此迁移管理的同名业务表时拒绝接管。API 进程只校验版本，禁止启动时自动修改数据库。

数据库关联全部使用 UUID 标量，不声明 GORM association，连接同时设置 `DisableForeignKeyConstraintWhenMigrating: true`。自增 id 仅用于表内主键及内部遍历。

仅数据库创建与迁移管理锁使用 GORM 无法直接表达的 MySQL 管理语句；业务和表结构均通过 GORM。禁止对旧库直接套用新的结构。

可用环境变量：`EXEC_GRAPH_CONFIG`、`EXEC_GRAPH_DATABASE_SCHEMA`、`EXEC_GRAPH_REDIS_PREFIX`、`EXEC_GRAPH_ADDR`、`EXEC_GRAPH_ENV`、`EXEC_GRAPH_ENABLE_DEMO_LOGIN`、`EXEC_GRAPH_ALLOWED_ORIGINS`（逗号分隔的精确 Origin）、`EXEC_GRAPH_FRONTEND_DIR`。生产环境禁止演示登录，默认不开启。

## Go 同时提供前端与 API

部署后只运行一个 Go 进程：`/` 提供前端首页，构建资源从 `frontend/dist` 读取，`/api/commands/...` 继续提供业务接口。不需要运行 Vite，也不需要 Nginx。原有 `/#my`、`/#project?...` 等 hash 路由保持不变。

从仓库根目录构建（服务器需安装 Bun 和 Go）：

```sh
cd frontend
bun install --frozen-lockfile
VITE_API_BASE_URL= VITE_ENABLE_API_MOCKS=false VITE_ENABLE_DEMO_LOGIN=false bun run build
cd ../backend
go build -o bin/exec-graph ./cmd/api
go build -o bin/exec-graph-manage ./cmd/manage
```

首次部署，复制 `etc/config.example.yaml` 为 `etc/config.local.yaml`，填写 MySQL、Redis 和所需外部能力配置，再显式初始化数据库：

```sh
./bin/exec-graph-manage migrate --create-database
```

在 `backend` 目录启动，将下面的 `服务器IP` 换成实际公网 IP：

```sh
EXEC_GRAPH_ADDR=0.0.0.0:8081 \
EXEC_GRAPH_FRONTEND_DIR=../frontend/dist \
EXEC_GRAPH_ALLOWED_ORIGINS=http://服务器IP:8081 \
EXEC_GRAPH_ENV=development \
EXEC_GRAPH_ENABLE_DEMO_LOGIN=false \
./bin/exec-graph
```

浏览器访问 `http://服务器IP:8081/`；服务器需放行 TCP 8081。前端 API 地址留空，页面和 API 使用同一个来源。`allowed_origins` 必须与浏览器访问的协议、IP 和端口完全一致，登录和写入请求也检查此配置。

上面的 IP HTTP 示例显式采用 `development` 环境，以允许 HTTP 会话 Cookie；直接 HTTPS 请求始终设置 Secure Cookie。`production` 环境无论请求协议均要求 Secure Cookie，适合只提供 HTTPS 登录的部署。演示登录仍关闭，构建后的前端也不启动 MSW；MySQL、Redis、邮件、图片和 AI 继续使用真实配置。

`app.frontend_dir` 与 `EXEC_GRAPH_FRONTEND_DIR` 都可以指定构建目录，环境变量优先；相对路径以 Go 进程的工作目录为准，后台托管进程时建议使用绝对路径。留空保持原有只提供 API 的开发方式；显式配置但缺少 `index.html` 时拒绝启动。仅发布构建目录，不列出目录内容，未知 API 和缺失资源返回 404，不回退成首页。

后续更新时重新拉取代码、构建前后端并重启这个 Go 进程即可；有新增迁移时，启动前显式执行 `exec-graph-manage migrate`。服务托管与一键更新脚本可以围绕这个单进程完成。

### 当前服务器与一键更新

当前部署目标为 `115.159.206.123`（腾讯云上海轻量实例 `lhins-18mt4ili`），公开地址为 `https://yinxu.fun/` 和 `https://www.yinxu.fun/`，两个域名的 A 记录均指向该 IP。Go 通过 `autocert` 自动申请和续期免费的 Let's Encrypt 证书，直接监听 TCP 80/443；域名的 HTTP 请求以 308 跳转 HTTPS，IP 保留 `http://115.159.206.123/` 访问。本次不为 IP 配置 HTTPS 证书。

服务器的私有配置中设置以下 app 字段（其他数据库、邮件等配置保留）：

```yaml
app:
  host: 0.0.0.0
  port: 80
  environment: development
  enable_demo_login: false
  session_ttl_hours: 168
  frontend_dir: /opt/exec-graph/current/frontend/dist
  allowed_origins:
    - https://yinxu.fun
    - https://www.yinxu.fun
    - http://115.159.206.123
  tls:
    enabled: true
    domains:
      - yinxu.fun
      - www.yinxu.fun
    cache_dir: /var/lib/exec-graph/autocert
```

保留 `development` 是为兼容 IP 的 HTTP 登录；域名 HTTPS 登录仍使用 Secure、HttpOnly、SameSite=Lax 的 Cookie。各域名和 IP 的登录状态相互独立。仅将域名加入 `allowed_origins` 不会申请证书，必须同时加入 `tls.domains`；不支持通配域名。首次 HTTPS 访问会触发申请，可能稍慢，后续从缓存读取并自动续期。开启此配置表示同意 Let's Encrypt 服务条款。

云防火墙与主机防火墙均需放行 TCP 80/443，并保持域名解析到本机；80 用于 HTTP-01 验证，443 同时支持 TLS-ALPN-01 验证。证书缓存含私钥，不能提交到 Git、放入前端 dist 或随发布版本删除。systemd 的 `StateDirectory=exec-graph` 创建归服务账号所有的 `/var/lib/exec-graph`，更新脚本不改动此目录。

原先为 Forgejo 提供网页的 Nginx 已停用并关闭开机启动，Forgejo 容器和数据保留。本应用由 `exec-graph.service` 托管，以 `execgraph` 账号运行，通过 `CAP_NET_BIND_SERVICE` 获得监听 80/443 所需的权限，开机自动启动。

- `/etc/exec-graph/config.yaml`：服务端私有配置，不进入 Git。
- `/opt/exec-graph/current`：当前运行版本，包含 Go 程序和前端 dist。
- `/var/lib/exec-graph/autocert`：自动证书及 ACME 账号缓存，仅服务账号可读写。
- `/usr/local/bin/exec-graph-update`：安装自 `backend/deploy/update.sh` 的更新命令。

先把待部署代码推送到 GitHub `main`，再在服务器执行：

```sh
exec-graph-update
```

命令自动拉取、构建、检查 MySQL／Redis、执行显式迁移，再切换版本并重启，最后检查首页和 API。构建或切换前的检查失败时，当前服务继续运行。首次部署可以通过 `EXEC_GRAPH_SOURCE_DIR` 使用上传的工作区快照；未推送的本地改动不会自动出现在 GitHub 拉取结果中。

更新脚本默认通过本机 IP 检查 80 端口的首页和 API（不触发域名跳转），公开访问地址默认为 `https://yinxu.fun`。可以通过 `EXEC_GRAPH_HEALTH_BASE_URL` 和 `EXEC_GRAPH_PUBLIC_URL` 覆盖；开启自动 HTTPS 时 HTTP 端口固定为 80，HTTPS 固定为 443。证书首次启用或新增域名后，还需从公网检查对应 HTTPS 地址，确认云防火墙、解析和证书签发成功。

查看服务与日志：

```sh
systemctl status exec-graph --no-pager
journalctl -u exec-graph -n 50 --no-pager
```

## 导入与启动

```sh
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage seed-demo
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 EXEC_GRAPH_ADDR=127.0.0.1:8081 EXEC_GRAPH_ENABLE_DEMO_LOGIN=true EXEC_GRAPH_ALLOWED_ORIGINS=http://localhost:5174 go run ./cmd/api
```

导入当前前端的 7 位演示作者、9 张图、37 条行动和 7 张本地图片。每位作者都有 `users.is_test_account = true`、`test_dataset = frontend-demo-v1` 数据库标记。精选保留 5 个表达，约定沿主要来源继承。合入来源仅提供事实背景，主动清空不会变回继承。

导入使用稳定 UUID，保留原作者和旧链接 alias。数据集标记和全部业务记录同事务提交；重复执行不会覆盖昵称、密码、精选等后续修改，导出内容改变后也不会静默覆盖。演示形成过程明确标记为 `demo-fixture`，不冒充真实 AI 调用。

默认给测试号生成未知随机密码。需要验证密码登录时，在**首次导入前**通过 `EXEC_GRAPH_DEMO_PASSWORD` 设置主测试号 `qiao@example.com` 的密码；不要写进源码或命令历史。已导入数据不会因再次设置环境变量而重置密码。开发环境可使用 `/auth/demo-login` 登录固定的乔账号，不接受任意用户 ID。

后端已嵌入导出夹具，启动和导入均不依赖前端源码。只有明确更新测试夹具时，才在仓库根目录运行 `bun backend/scripts/export-demo.ts`；导出后的 JSON 和图片需一并审查。夹具变化需要新的导入版本和显式迁移方案，不要直接删除已使用的数据集标记。

## 已实现接口

以下路径均以 `/api/commands` 开头；JSON 响应统一使用 `{code, msg, data}`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/system/health` | 检查真实 MySQL、Redis 就绪状态 |
| POST | `/auth/login` | 邮箱密码登录，JSON 为 `email`、`password` |
| POST | `/auth/demo-login` | 显式开发模式登录固定测试号，JSON 为 `{}` |
| GET | `/auth/session` | 当前账户及 CSRF token |
| POST | `/auth/logout` | JSON 为 `{}`，需 `X-CSRF-Token` |
| POST | `/auth/code-send`、`/auth/register`、`/auth/password-reset` | 邮件验证码、注册及找回密码 |
| POST | `/auth/password-change`、`/auth/email-change` | 当前密码与验证码双重校验，成功撤销旧会话 |
| GET | `/profiles/catalogue` | 公开用户资料，不含邮箱和测试管理字段 |
| GET | `/graphs/catalogue` | 可见图目录 |
| GET | `/graphs/detail?graphId=...` | 单图资料 |
| GET | `/actions/context?graphId=...` | 图内完整确认上下文 |
| GET | `/actions/detail?nodeId=...` | 单个行动 |
| GET | `/following/sources` | 当前登录账号的关注集合 |
| GET | `/media/file?assetId=...` | 已就绪图片；成功时返回二进制，不套 JSON |
| POST | `/media/upload`、`/media/retain` | 上传登记与草稿图片续期 |
| POST | `/ai/generate` | 平台 AI 生成私有草稿，需要提交键 |
| GET | `/ai/generation?generationId=...` | 读取本人生成结果及确认参数 |
| POST | `/graphs/create`、`/graphs/update`、`/graphs/delete` | 图创建、版本更新和受保护删除 |
| POST | `/actions/create` | 确认服务端 AI 结果并原子发布行动 |
| POST | `/expressions/update`、`/agreements/update` | 终点表达／约定的版本化确认 |
| POST | `/profiles/update`、`/profiles/highlights-set` | 公开资料、最多五个表达精选及顺序 |
| POST | `/following/set` | 显式设置用户／图关注状态 |

使用 HttpOnly cookie 和 Redis 会话；客户端需携带 cookie。每次会话读取检查数据库停用状态及认证版本。密码采用 Argon2id，不提供明文或可逆密码读取。

读取兼容导入数据的旧短 ID，但响应资源 ID 一律为 UUID；写入只接受 UUID。行动 DTO 使用 `graphId`，前端已显式映射为 UI 的 `projectId`；关注模型已使用 `graphIds`。未确认的 AI 对话不会公开。

写入的准确 DTO、权限和事务行为见 [真实后端写入契约](../doc/backend-write-contract.md)。创建带 `Idempotency-Key`，全部业务写入带 CSRF，修改带 `expectedVersion`。图和资料图片接受已上传的资产 UUID；行动及表达确认使用 `generationId`，不接受浏览器直接伪造的 AI 文稿／对话。

前端默认关闭 MSW，真实认证、上传、生成和确认发布已接入。外部能力 DTO、私有草稿隔离、限时和回收边界见 [外部能力契约](../doc/backend-external-contract.md)。未知接口返回 404，不返回模拟成功。

## 外部能力配置

参考 `etc/config.example.yaml`。真实邮件需 `mail.enabled`、发件地址、模板 ID、区域及服务端凭据；真实图片需 `storage.enabled`、bucket、region 和专用 `media_prefix`。旧配置的凭据仅由 bootstrap 创建 SDK 时读取，不进入业务用例。平台 AI 配置 `ai.base_url`、`ai.model`、`ai.api_key`，也可通过 `DEEPSEEK_API_KEY` 注入密钥，示例模型为 `deepseek-flash`。不要把真实配置提交到 Git。

第四阶段 schema v2 增加图片保留登记表，已有 v1 数据执行同一 `manage migrate` 升级，保留原用户和业务身份。上传未保存的图片一天后可回收；本地草稿续期七天，公开或历史引用仍受保护。API 启动时及每小时扫描一批，也可运行：

```sh
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage prune-media
```

浏览器启动命令见 [前端说明](../frontend/README.md)。开发测试号入口需要前后端分别显式开启，不能在生产环境开启。

## 账号资源限额

`etc/config.example.yaml` 的 `limits` 展示完整配置；本地配置没有这些字段时自动使用默认值。AI 每账号每日 100 次、滚动一分钟 10 次、同时在途 2 次；图片每日 100 次、滚动一分钟 20 次，受管上传总容量 512 MiB。所有值必须为正整数，修改后重启 API；每日按 UTC 自然日（北京时间 08:00）切换。

在数据库账号锁内检查用量并登记请求，多实例共用额度；超限返回 429／10006。失败尝试也计次数，AI 同键重放不再计数；图片只有云端删除并在数据库确认后才释放容量，删除不返还当日次数，草稿续期不额外计费。演示导入不计真实调用／上传用量。计数复用现有幂等登记及资产生命周期记录，本阶段没有新增表或迁移，当前仍为 schema v2。

详细口径及边界见 [外部能力契约](../doc/backend-external-contract.md#账号限流与用量配额)。这不是平台总费用预算或按 token 计费系统；下一步仍需处理远端列表分页和移动端适配。

## 验证

```sh
go test ./...
go vet ./...
EXEC_GRAPH_CONFIG=/absolute/path/to/config.local.yaml EXEC_GRAPH_INTEGRATION=1 go test -timeout 30m ./...
```

`manage check` 探测真实 MySQL 与 Redis。`manage verify` 检查实际 schema、模型表及无外键约定。真实外部服务不可达时返回失败，不使用内存数据库代替。

实库测试创建随机 MySQL schema 和独立 Redis 前缀，测试结束删除自己的 schema，不清空旧库或共享 Redis。覆盖 GORM 迁移、约束、测试号导入、重复导入、真实 HTTP 登录／读取／退出、公开字段隔离、图片、未确认消息隔离及会话撤销，以及业务写入的权限、幂等、版本、继承／清空、精选、失败回滚和并发竞争。未设置 `EXEC_GRAPH_INTEGRATION=1` 时，这些外部依赖测试明确跳过。

云端验收另显式设置 `EXEC_GRAPH_STORAGE_INTEGRATION=1`、`EXEC_GRAPH_AI_INTEGRATION=1` 或 `EXEC_GRAPH_MAIL_INTEGRATION=1`；邮件还需 `EXEC_GRAPH_MAIL_TEST_RECIPIENT` 指定获授权的收件地址。它们会产生真实外部调用，普通实库回归不重复发送邮件或调用付费模型。测试替身只验证协议及事务，不当作云端可用性证据。
