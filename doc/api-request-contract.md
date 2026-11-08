# 前后端请求契约

状态：当前已接入功能的请求约定。未实现的远端分页、搜索、引用详情等设计不写入本契约；新增接口先实现，再补文档。代码、测试和后端 DTO 是最终依据。

正式写入 DTO 见 [真实后端写入契约](backend-write-contract.md)，认证、图片和平台 AI 见 [外部能力契约](backend-external-contract.md)。

## 1. 请求边界

- 业务请求统一经过 `frontend/src/shared/api/client.ts`；领域请求函数放在所属 entity/feature 的 `api/`。组件和 Query 不直接调用 `fetch`，不拼接接口路径。
- 路径固定为 `/api/commands/<领域>/<动作>`，领域和动作用英文小写，多词用 `kebab-case`。资源 ID 放在 query 或 JSON，不放路径。
- 仅使用 `GET` 和 `POST`。GET 读取，POST 创建、修改、删除或执行有副作用的操作。图片上传使用 POST multipart。
- 普通 POST 使用 `Content-Type: application/json`。JSON 字段和 query 参数用 camelCase；枚举值使用稳定英文标识。
- 统一客户端基于 `VITE_API_BASE_URL` 解析服务根地址，默认值为空；该变量不包含 `/api/commands`，不能包含凭据。
- 当前 UI 仍使用 `projectId` 表示图，接口传输统一使用 `graphId`；实体 API 负责显式映射，不能让两种字段靠类型断言互相替代。

## 2. 参数与资源身份

- 图、节点、用户、引用、图片和 AI 生成任务使用稳定 UUID；数据库自增主键不对外暴露。
- 节点的 `number` 是图内稳定展示编号，`level` 是引用深度；二者都不能代替节点 UUID 发起更新。编号由后端分配，客户端不能用列表长度或最大编号加一生成。
- 时间使用带时区的 ISO 8601 字符串，服务端输出 UTC，例如 `2026-10-22T03:30:00.000Z`；前端按本地时区展示。
- query 通过 `URLSearchParams` 编码一次；未选择的筛选条件省略，不发送 `"undefined"`／`"null"`。布尔值用 `true`／`false`。
- 搜索关键词去除首尾空白；正文、Markdown 和对话内容不由通用客户端擅自裁剪、改写或清空。
- 缺省、`null`、空字符串语义不同，客户端不得全局互相转换。表达和约定的更新必须使用显式模式，见第 6 节。
- 每个端点只接收明确 DTO；未知字段由后端拒绝。公共用户摘要不包含邮箱。

## 3. 统一 JSON 响应

业务成功返回 HTTP 200，使用统一结构：

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

- `code` 是整数，只有 `0` 表示业务成功；成功 `msg` 为空，失败为可展示的中文说明。
- `data` 必须存在。成功时返回端点 DTO、数组或 `null`；失败固定为 `null`。空列表用 `[]`，不能用 `null` 代替。
- 当前不返回 204；没有返回内容的成功操作也返回 `{ "code": 0, "msg": "", "data": null }`。
- 只有 HTTP 成功且 `code === 0` 才算成功；HTTP 200 内的非零 code 和所有非 2xx 响应都进入错误处理。
- 成功响应必须是合法 JSON；HTML 代理错误页、空响应不能转成空数据或演示数据。
- 响应带 `X-Request-Id`；客户端保留用于诊断，不把服务端堆栈或 SQL 暴露给用户。
- 文件下载和图片读取保持二进制协议，不使用此 JSON 外壳。

## 4. 错误码

`frontend/src/shared/api/contracts.ts` 定义通用错误码。

| code | HTTP | 含义 |
| --- | --- | --- |
| `10001` | 400 | 请求参数不合法 |
| `10002` | 401 | 尚未登录或会话已失效 |
| `10003` | 403 | 无操作权限 |
| `10004` | 404 | 资源不存在 |
| `10005` | 409 | 状态冲突，包括版本过期、来源已变化 |
| `10006` | 429 | 请求过于频繁 |
| `10007` | 500 | 服务内部错误 |
| `10008` | 503 | 服务暂不可用 |
| `10009` | 502 | 上游服务失败 |

- 客户端按 code 或明确的错误类别判断，不比较中文 `msg`；未知非零 code 也按失败处理。
- 401 由应用层集中清理旧账号缓存并回到登录页；403、404、409 在当前功能中提示，不统一跳首页。
- 通用客户端不弹 toast；表单错误由表单展示，查询错误由当前内容区展示。

## 5. 认证、会话与安全

- 业务接口使用 `Authorization: Bearer <token>`，token 可保存在浏览器 localStorage，不写入 Zustand 或 Query 缓存。
- `GET /api/commands/auth/session` 返回已认证账户；无有效 token 返回 401／10002。只有该错误视为匿名，网络错误和服务端错误不能转成退出状态。
- 当前使用 Bearer token，不使用 Cookie；业务写入已关闭 CSRF 校验，前端不依赖 CSRF token。
- 登录、注册、找回密码、修改密码和邮箱变更会在成功后撤销旧会话；客户端需要清理旧账号缓存并重新登录。
- CORS 允许配置明确来源，也允许 `*` 回显任意来源；鉴权由 token 和权限校验负责，不使用 Cookie 凭据。
- `auth/demo-login` 只在显式开发配置下可用，生产环境关闭。
- 普通 JSON 查询默认超时 15 秒；图片上传 60 秒；AI 生成 110 秒。前端请求函数接收 AbortSignal；主动取消不弹失败提示，也不代表服务端写入已撤销。

## 6. 写入、版本与 AI 确认

- 创建图、发布行动和 AI 生成使用 `Idempotency-Key` UUID。同一逻辑提交的不确定结果重试复用同一个键；同一键不同内容返回 10005。服务端按账号和操作隔离，至少保留 24 小时。
- 可编辑资源返回 `version`，更新请求带 `expectedVersion`；版本不符返回 10005，不能静默覆盖。
- 发布行动由后端在同一用例中重新校验来源版本、作者身份、引用背景和节点编号，不依赖前端先查后写。
- 删除使用 POST，由后端重新检查作者、参与者和节点数量；失败时保留页面状态。
- 图片使用已上传资产 UUID，不接收 data URL、第三方 URL 或浏览器生成的文稿。
- 表达和约定使用显式更新模式：

```ts
type DocumentUpdate =
  | { mode: 'inherit' }
  | { mode: 'update'; markdown: string }
  | { mode: 'clear' }
```

- 新行动默认继承主要来源已发布的表达和约定；某一种没有可继承版本时，只把该种创建为待生成。自己的来源不参与来源约定核对。
- 每条直接引用独立记录 `complies: true | false | null`；`null` 表示尚未核对。不满足时带说明；不满足和未知都不自动阻止发布，不引入申请或批准流程。
- 发布行动和确认文档只使用服务端 `generationId` 及返回的确认参数，不接受浏览器直接提交 AI 正文。
- AI 相关接口：`ai/generate` 生成草稿，`ai/generation` 读取任务，`ai/chat` 由模型判断继续生成或核验，`ai/verify` 显式核验，`ai/node-documents` 生成节点文档草案，`ai/place-images` 放置图片。
- `ai/chat` 的“核验”意图由模型判断，不依赖前端关键词；生成和核验由服务端读取事实与固定提示词。
- 当前读取使用完整图上下文，没有远端分页和搜索分页；数据量增长前再新增分页契约。

## 7. 当前接入的接口

认证：

```text
POST auth/login
POST auth/logout
POST auth/code-send
POST auth/register
POST auth/password-reset
POST auth/password-change
POST auth/email-change
POST auth/demo-login（仅开发配置）
GET  auth/session
```

读取：

```text
GET system/health
GET profiles/catalogue
GET graphs/catalogue
GET graphs/detail
GET actions/context
GET actions/detail
GET following/sources
GET media/file
GET actions/node-documents
GET ai/generation
GET ai/prompt-defaults
```

写入：

```text
POST profiles/update
POST profiles/highlights-set
POST following/set
POST graphs/create
POST graphs/update
POST graphs/delete
POST actions/create
POST actions/delete
POST actions/publish-document
POST expressions/update
POST agreements/update
POST media/upload
POST media/retain
POST ai/generate
POST ai/chat
POST ai/verify
POST ai/node-documents
POST ai/place-images
```

`GET actions/context?graphId=...` 返回图内完整行动数组；`actions/detail?nodeId=...` 返回单节点。`graphs/detail?graphId=...` 和 `actions/detail?nodeId=...` 的 ID 都在 query，不使用路径参数。

## 8. 前端状态与 Query

- TanStack Query 是远端事实的唯一客户端缓存；不把图、节点、用户资料再复制到 Zustand 或组件 state。
- query key 包含资源、当前账号作用域、影响结果的已提交筛选和排序；不把 token、AbortSignal 或整个表单放进 key。
- 写入成功后按领域失效关联查询；发布和删除不做默认乐观更新。失败保留输入，成功后清除对应草稿。
- IndexedDB 草稿与已发布事实分开管理；恢复草稿前校验账号、图、操作和目标节点。
- 切换账号或退出时取消并清理旧账号私有查询；未激活页面不主动发起自动查询。
- MSW 只在显式设置 `VITE_ENABLE_API_MOCKS=true` 的开发构建启用；生产不启动 worker，真实请求失败不自动回退模拟数据。
- 模拟接口必须使用相同路径、参数、错误码和 DTO，不绕过领域 API 填充 Query 缓存。

## 9. 验证重点

- HTTP 成功但 code 非零、HTTP 错误、非 JSON、空 data；
- 认证失效、权限、版本冲突和重复提交；
- 取消、超时、重试边界；
- 账号切换后的查询隔离；
- 表达/约定继承、清空和来源版本变化；
- 本地草稿恢复、失败保留和成功清理。
