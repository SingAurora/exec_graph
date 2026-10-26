# 认证、图片与平台 AI 接入契约

路径均以 `/api/commands` 开头。除图片文件读取外，响应使用 `{code, msg, data}`；未知 JSON 字段拒绝接收。资源身份为 UUID，客户端不传数据库自增 ID。业务发布规则见 [写入契约](backend-write-contract.md)。

## 邮件认证

| 方法／路径 | 请求 JSON | 成功 data |
| --- | --- | --- |
| POST `/auth/code-send` | `{purpose, email}` | `{expiresIn, retryAfter}`，单位秒 |
| POST `/auth/register` | `{email, code, password, name}` | 与登录相同的会话资料，同时设置 HttpOnly cookie |
| POST `/auth/password-reset` | `{email, code, password}` | `null`，清除当前 cookie |
| POST `/auth/password-change` | `{currentPassword, password, code}` | 空对象，清除当前 cookie |
| POST `/auth/email-change` | `{currentPassword, email, code}` | 空对象，清除当前 cookie |

`purpose` 为 `register`、`reset-password`、`change-password` 或 `change-email`。后两项发送和提交均需要会话及 CSRF；修改密码向当前绑定邮箱发送，修改邮箱向新邮箱发送。注册、找回密码和登录不要求先有会话。

验证码为随机六位数字，默认十分钟有效，Redis 只存摘要；绑定用途、邮箱以及必要的账号身份。五次错误后失效，正确验证码原子消费一次。同用途同邮箱每分钟一封，同 IP 每小时最多二十封。发送失败撤销验证码，不返回验证码或上游凭据。邮件 SDK 接受请求不等于确认收件箱送达。

密码至少八个字符、最多 256 字节，使用 Argon2id 哈希。普通注册不能设置测试号标记。重置密码、修改密码或邮箱在事务内递增认证版本，撤销该账号全部旧会话；成功后需要重新登录。Redis 验证码消费和 MySQL 写入不是分布式事务：消费后数据库失败时需要重新获取验证码。

## 图片上传与未保存回收

- POST `/media/upload`：会话与 CSRF，`multipart/form-data` 的 `file` 字段，单张 JPEG／PNG／WebP。校验实际文件内容而非仅扩展名，最大 8 MiB、两千万像素。
- 返回 `{assetId, url, mimeType, byteSize, width, height, retainUntil}`。浏览器只向业务提交 `assetId`；对象键及存储凭据不公开。
- POST `/media/retain`：会话与 CSRF，JSON `{assetIds: UUID[]}`，返回 `{assetIds, retainUntil}`。只续期本人已就绪图片；空数组不续期任何文件。
- GET `/media/file?assetId=UUID`：未保存图片只允许上传者读取；存在公开业务引用后可匿名读取。成功返回图片二进制，失败仍返回标准 JSON 错误。

上传先登记 pending，事务外上传对象，再标记 ready。新文件保留一天；草稿显式续期后保留七天，前端恢复草稿时续期，打开期间每十二小时再续期。资料图片在保存时上传；行动配图上传后将资产 UUID 保存到本机草稿，最多十二张。清除草稿或关闭页面不会立即删除远端对象。

API 启动时以及每小时扫描最多一百个过期候选，管理命令 `go run ./cmd/manage prune-media` 可补充执行。回收在资产锁内重查资料、图、行动及历史文档引用，先认领再删除对象；对象删除失败五分钟后重试。逻辑删除图和历史引用仍保守保护图片。清理只处理本站专用 `storage.media_prefix`，不删除旧项目目录及内嵌演示资源；过期回收不是浏览器即时删除请求。

## 平台 AI 生成

POST `/ai/generate`：会话、CSRF 和 UUID 格式的 `Idempotency-Key`。

```ts
type GenerateInput = {
  mode: 'action' | 'expression'
  graphId: string
  conversationId?: string
  nodeId?: string
  expectedVersion?: number
  message: string
  parentId?: string
  mergedParentIds: string[]
  sourceVersions: { nodeId: string; version: number }[]
  agreement:
    | { mode: 'inherit' }
    | { mode: 'clear' }
    | { mode: 'update'; markdown: string }
}
```

新行动提交直接来源及版本；首次行动不能继承约定。表达修改提交当前节点及版本，不改变引用；`agreement` 用 inherit，约定另行保存。每轮输入最多一万字符。图指引、可达历史事实、有效表达约定和对话由服务端读取，不接受浏览器提供 system prompt、平台 key 或任意上游地址。

首次请求短事务登记 pending，事务外调用平台模型，再短事务保存输出；重复键同输入只读取原任务，同键不同输入返回 409。返回：

```ts
type GenerationView = {
  generationId: string
  conversationId: string
  status: 'pending' | 'succeeded' | 'failed'
  errorCode?: string
  draft?: {
    reply: string
    title: string
    objective: string
    expression: GenerateInput['agreement']
    reviews: { sourceId: string; complies: boolean | null; exceptionReason?: string }[]
  }
  createAction?: CreateActionInput
  updateExpression?: { nodeId: string; expectedVersion: number; generationId: string }
}
```

GET `/ai/generation?generationId=UUID` 只返回本人发起的任务。pending 时客户端轮询；响应丢失重试复用原请求键。明确失败后新一轮生成使用新键。服务端模型调用限六十秒、HTTP 用例一百秒，前端生成请求一百一十秒；进程中断遗留 pending 两分钟后释放对话占用。超时和取消不代表既有数据库写入被撤销。

模型输出通过结构和业务规则校验，损坏、截断或无效文档返回失败，不假装生成成功。约定核对区分 `true`、`false` 和 `null`，未知不自动视为满足。来源背景只包括当前引用链路及合入的可达事实；整理已有表达同时保留原始引用约定背景。

生成成功仍未发布。浏览器展示草稿，确认时提交返回的 `createAction`／`updateExpression`，配图只补入资产列表；不重新提交 AI 正文。服务端检查生成、图指引、节点版本和来源快照，变化时拒绝确认。公开形成过程只包含该生成实际采用的消息；其他人的未确认输入既不进入模型，也不随确认公开。生成后本人追加输入会使旧结果不可确认。

## 前端与部署边界

前端默认关闭 MSW，Vite 只将 `/api` 转发到 `API_PROXY_TARGET`。密钥保存在被 Git 忽略的服务端配置或 `DEEPSEEK_API_KEY` 环境变量中，没有个人 key 配置，也不注入前端构建。示例平台模型为 `deepseek-flash`，可在后端配置修改。

登录、退出、账户安全成功及统一 401 边界清理旧账号查询；保留活跃会话查询订阅。网络／数据库错误不能被视为匿名或退回模拟数据。真实响应 ID 为 UUID；导入记录可带显式 `legacyId` 用于旧 hash 链接和本地草稿定位，不能自行推算别名。

MSW 仅在显式开发开关下提供固定生成替身及业务确认契约，不模拟真实邮件、账户安全或对象存储；未覆盖请求应失败。当前目录和图上下文仍整体读取，尚未实现远端分页。AI 尚无账号费用配额，上传也没有账号总存储配额；这些是公开运营前需要补齐的限制，不能把本机功能验收等同于生产容量验收。
