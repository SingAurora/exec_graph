# 认证、图片与平台 AI 接入契约

路径均以 `/api/commands` 开头。除图片文件读取外，响应使用 `{code, msg, data}`；未知 JSON 字段拒绝接收。资源身份为 UUID，客户端不传数据库自增 ID。业务发布规则见 [写入契约](backend-write-contract.md)。

## 邮件认证

| 方法／路径 | 请求 JSON | 成功 data |
| --- | --- | --- |
| POST `/auth/code-send` | `{purpose, email}` | `{expiresIn, retryAfter}`，单位秒 |
| POST `/auth/register` | `{email, code, password, name}` | 与登录相同的会话资料和 token |
| POST `/auth/password-reset` | `{email, code, password}` | `null`，撤销当前 token 的服务端会话 |
| POST `/auth/password-change` | `{currentPassword, password, code}` | 空对象，撤销当前 token 的服务端会话 |
| POST `/auth/email-change` | `{currentPassword, email, code}` | 空对象，撤销当前 token 的服务端会话 |

`purpose` 为 `register`、`reset-password`、`change-password` 或 `change-email`。后两项发送和提交均需要 token；修改密码向当前绑定邮箱发送，修改邮箱向新邮箱发送。注册、找回密码和登录不要求先有会话。

资料更新的 `locationCode` 为可空的中国大陆区县行政区划代码。服务端只接受内置行政区划中的六位区县代码，返回的 `AccountView` 和公开资料会同时提供 `location` 的省、市、区县名称；`null` 表示未设置。

验证码为随机六位数字，默认十分钟有效，Redis 只存摘要；绑定用途、邮箱以及必要的账号身份。五次错误后失效，正确验证码原子消费一次。同用途同邮箱每分钟一封，同 IP 每小时最多二十封。发送失败撤销验证码，不返回验证码或上游凭据。邮件 SDK 接受请求不等于确认收件箱送达。

昵称去除首尾空白后为 1～30 个 Unicode 码点，拒绝换行、控制字符和不可见格式字符；注册与资料编辑共用规则。个人简介去除首尾空白后最多 512 个 Unicode 码点，包含 Markdown 与图片网址；内部换行不计入额外限制。邮箱去除首尾空白、转小写后最多 64 个 UTF-8 字节。

新密码为 8～32 位，只允许英文、数字和可见普通符号，不允许空格、中文、表情、控制字符或不可见格式字符。密码不做 trim、大小写转换或 Unicode 规范化，非法输入报错而不静默修改。登录及修改凭据时的当前密码仍原样验证，不追溯应用新密码的字符限制。

密码使用 Argon2id 哈希。普通注册不能设置测试号标记。重置密码、修改密码或邮箱在事务内递增认证版本，撤销该账号全部旧会话；成功后需要重新登录。Redis 验证码消费和 MySQL 写入不是分布式事务：消费后数据库失败时需要重新获取验证码。

## 图片上传与未保存回收

- POST `/media/upload`：token，`multipart/form-data` 的 `file` 字段，单张 JPEG／PNG／WebP。校验实际文件内容而非仅扩展名，最大 8 MiB、两千万像素。
- 返回 `{assetId, url, mimeType, byteSize, width, height, retainUntil}`。浏览器只向业务提交 `assetId`；对象键及存储凭据不公开。
- POST `/media/retain`：token，JSON `{assetIds: UUID[]}`，返回 `{assetIds, retainUntil}`。只续期本人已就绪图片；空数组不续期任何文件。
- GET `/media/file?assetId=UUID`：未保存图片只允许上传者读取；存在公开业务引用后可匿名读取。成功返回图片二进制，失败仍返回标准 JSON 错误。

上传先登记 pending，事务外上传对象，再标记 ready。新文件保留一天；草稿显式续期后保留七天，前端恢复草稿时续期，打开期间每十二小时再续期。资料图片在保存时上传；行动配图上传后将资产 UUID 保存到本机草稿，最多十二张。清除草稿或关闭页面不会立即删除远端对象。

API 启动时以及每小时扫描最多一百个过期候选，管理命令 `go run ./cmd/manage prune-media` 可补充执行。回收在资产锁内重查资料、图、行动及历史文档引用，先认领再删除对象；对象删除失败五分钟后重试。逻辑删除图和历史引用仍保守保护图片。清理只处理本站专用 `storage.media_prefix`，不删除旧项目目录及内嵌演示资源；过期回收不是浏览器即时删除请求。

## 平台 AI 生成

POST `/ai/generate`：Bearer token 和 UUID 格式的 `Idempotency-Key`。浏览器离开或断开只会中止等待，已受理的生成在服务端继续完成并落库；重新进入工作区时用同一幂等键恢复读取或轮询。当前不是持久任务队列，服务进程重启仍会丢失正在处理的 pending 任务，需要重新发起。

POST `/ai/chat`：Bearer token，提交与 `/ai/generate` 相同的生成输入，并额外带当前 `generationId`。有当前草稿时，服务端先用一次模型意图路由判断用户是在要求核验还是继续整理：核验返回 `{kind:"verification", verification}`，否则返回 `{kind:"generation", generation}`。路由不依赖前端关键词，一轮对话只返回一条结果。

POST `/ai/verify`：Bearer token，JSON `{generationId}`。只对当前账号已成功的生成执行一次显式核验，服务端读取已存草稿、报告和来源，按对应模式返回 `{generationId, status, message, sourceReviews}`；不生成新草稿。它是 `/ai/chat` 内部的核验能力，前端不单独提供按钮。

```ts
type GenerateInput = {
  mode: 'action' | 'expression' | 'agreement'
  graphId: string
  conversationId?: string
  nodeId?: string
  expectedVersion?: number
  messages: string[]
  parentId?: string
  mergedParentIds: string[]
  sourceVersions: { nodeId: string; version: number }[]
  agreement:
    | { mode: 'inherit' }
    | { mode: 'clear' }
    | { mode: 'update'; markdown: string }
  /** 仅 action 模式；备注必填，AI 用它决定图片在正文中的位置。 */
  images: { assetId: string; alt: string }[]
  /** 上一轮显式核验的具体失败原因，用于下一轮定向改写。 */
  feedback?: string
}
```

行动、表达和约定使用按节点及类型隔离的三类 AI 对话。行动提交直接来源及版本，记录本次行动、结果、明确观察和用户对此次行动的个人想法，并核对来源约定；只要行动交代具体，不因同时包含有本人报告依据的主观复盘而拒绝整篇，预测不能伪装成已发生结果。表达修改提交当前节点及版本，不改变引用；表达面向其他用户，重点写从行动中显露的兴趣、偏好、态度和可讨论的判断，不是行动流水账。约定修改提交当前节点及版本，不改变行动或表达。行动发布时表达和约定默认继承主要来源的已发布文档，用户可以直接发布，不需要等待生成；只有根节点或来源没有可继承文档时，才用 Thinking 模型自动生成。继承内容过时也不阻塞发布，之后可在各自工作区独立调整。每条用户消息最多 1000 字符，每轮合计最多一万字符、最多 50 条。行动图片最多 12 张，每条备注必填且最多 30 字符；图片通过独立的图片放置请求处理，不随文本行动生成一起提交，AI 看不到图片像素，只能根据备注和正文语义选择位置。继承文档直接作为当前节点的已发布表达/约定，子行动只读父节点已发布的约定做入站核对；满足只表示有继续沟通的意愿。可达历史事实、有效表达约定和对应类型的历史对话、固定平台提示词由服务端读取，不接受浏览器提供 system prompt、平台 key 或任意上游地址。

首次请求短事务登记 pending，事务外调用平台模型，再短事务保存输出；重复键同输入只读取原任务，同键不同输入返回 409。返回：

```ts
type GenerationView = {
  generationId: string
  conversationId: string
  status: 'pending' | 'succeeded' | 'failed'
  /** 本轮实际生成回复的模型名，用于对话展示和复制；旧记录可能没有。 */
  model?: string
  errorCode?: string
  draft?: {
    reply: string
    title: string
    objective: string
    expression: GenerateInput['agreement']
    agreement?: GenerateInput['agreement']
    reviews: { sourceId: string; complies: boolean | null; exceptionReason?: string }[]
    /** 实际放入正文的图片；正文中使用 asset 引用，不保存临时 URL。 */
    images?: { assetId: string; alt: string }[]
    /** 没有放入正文的图片及原因，用于前端提示。 */
    invalidImages?: { ref: string; reason: string }[]
  }
  createAction?: CreateActionInput
  updateExpression?: { nodeId: string; expectedVersion: number; generationId: string }
  updateAgreement?: { nodeId: string; expectedVersion: number; generationId: string }
}
```

POST `/ai/node-documents`：token，JSON `{nodeId: UUID}`。只为作者尚未被接续的终端节点生成缺失的表达和约定草案，继承已发布文档时不调用模型；失败返回业务错误并把缺失文档标记为 `failed`，不伪造空文档。成功返回两条节点文档状态。

GET `/actions/node-documents?nodeId=UUID`：只向节点作者返回表达/约定状态和 AI 草案。

POST `/actions/publish-document`：token，JSON `{nodeId, expectedVersion, kind: 'expression' | 'agreement'}`。把当前 AI 草案发布为不可变文档版本；只有终端节点、作者版本匹配且草案非空时成功。表达和约定都发布后节点才可被接续。

GET `/actions/document-history?nodeId=UUID`：返回节点自己发布过的表达/约定版本，不沿祖先继承。

POST `/actions/delete`：token，JSON `{nodeId, expectedVersion}`。只允许作者删除尚未被接续的终端节点；删除节点文档、引用和图片关系。

POST `/ai/place-images`：token，JSON `{generationId: UUID, images: {assetId, alt}[]}`。只对当前账号已成功且未确认的行动草稿做图片放置；服务端读取当前正文，AI 只返回图片位置和无效图片说明，正文文字必须保持不变。该请求不重新生成行动、不重新核验正文事实，返回更新后的 `GenerationView`。图片备注仍必填，最多 12 张、每张 30 字；`images` 为空数组时只清除正文已有图片引用，不调用图片放置模型。当前实现不要求幂等键，重复点击可能重复调用图片放置模型。

GET `/ai/generation?generationId=UUID` 只返回本人发起的任务。pending 时客户端轮询；响应丢失重试复用原请求键。明确失败后新一轮生成使用新键。单次生成模型调用最多六十秒；需要核对引用来源约定时，生成与核验分别最多六十秒，HTTP 用例一百秒，前端生成请求一百一十秒；进程中断遗留 pending 两分钟后释放对话占用。超时和取消不代表既有数据库写入被撤销。

模型输出通过结构和业务规则校验，损坏、截断或无效文档返回失败，不假装生成成功。约定核对区分 `true`、`false` 和 `null`，未知不自动视为满足。行动不选择合入背景，只沿当前承接链记录实际行动；表达和约定仍保留原始来源背景。

生成规则版本为 `action-evidence-v21`。表达和约定的快照包含从根到当前节点的完整 `branch`；生成时不能只看当前节点。表达默认 2～4 句、1～3 个行动例子，约定默认两句话；用户说“给我一个默认效果的表达/约定”时按默认效果生成。行动正文推荐在末尾按来源逐条回应约定，没有逐条回复时由 AI 按报告灵活判断，不硬性拒绝。行动输入先在本地对话中收集，点击“整理行动”后批量提交；行动整理使用非 Thinking 模型。生成阶段不自动调用核验，确保一轮生成只返回一条 AI 回复和一份草稿。用户在对话中自然表达核验时，`/ai/chat` 先由模型判断意图，再执行服务端核验；只返回一条结果，不产生第二条自动 AI 回复。表达和约定工作区及自动节点文档生成使用 Thinking 模型。模型角色只在服务端配置，用户不能选择。行动工作区默认用户提交的是已发生经历，不再询问是否完成；行动不提供合入背景，约定只承接其他用户的终端节点；第一人称操作、战术安排和“第N个任务目标”按回顾性经历处理，明显预测保留为主观判断。行动标题及正文只整理本人报告的已发生经过、结果、明确观察和对本次行动的个人想法，不添加未经报告的关键行动、细节或结果；标题最多 30 字，正文最多 2000 字，超过时要求精简或拆成多个行动。行动图片使用 `{{image:N}}` 占位符，由服务端映射为站内 asset 引用；模型不得输出图片 URL、assetId 或外部 Markdown 图片。备注为空、含义不清或与行动无关时视为无效图片，不放入正文，并在 `invalidImages` 和回复中说明；模型漏放的图片由服务端补记为无效并提示。新表达只能基于可达行动；新行动生成时可同时依据本次原始报告，单独编辑表达时聊天中新补充的经历不能代替已发布行动。行动正文不要求逐句引用；来源约定只作提示。表达和约定涉及事实锚点时，引用必须包含可查的原始报告／行动 ID 与连续原文；后端验证引用范围和原文存在性。语义判断仍依赖模型，不能视为现实真实性证明或零误判保证。

行动模式的正文由用户确认，服务端不再用模型判断“是否完成、是否计划、是否新增结果”；行动核验只检查来源约定。表达和约定仍按“依据核验”和“目标适配”检查。生成阶段不自动调用这些规则；用户在对话中要求核验时，`POST /ai/chat` 先由模型判断意图，再调用同一套核验规则，用已存草稿、报告和来源执行一次核验并返回一条结果。来源约定仍按字面拆分条件，满足为 `true`、明确不符为 `false`、缺信息为 `null`。表达和约定的依据分别来自已发布行动和当前行动；不新增公开 DTO 或数据库列。

生成成功仍未发布。浏览器展示草稿，确认时提交返回的 `createAction`／`updateExpression`；行动配图必须与生成正文的 asset 引用一致，不能追加、删除或换序。不重新提交 AI 正文。服务端检查生成、节点版本和来源快照，变化时拒绝确认。公开形成过程只包含该生成实际采用的消息；其他人的未确认输入既不进入模型，也不随确认公开。生成后本人追加输入会使旧结果不可确认。

`reply` 是形成过程里可见的 AI 发言，只需用一两句话概括本轮整理，并提示到对应的“行动／表达／约定”tab 查看完整草稿；不要复述标题、正文或逐项细节，也不能只写“已记录/已收到”。回复应明确这是待确认草稿，不声称已发布。已经发布的旧记录保留当时的回复，不会因提示词更新而回溯改写；完整正文仍在形成过程下方的文档结果中读取。

旧规则生成但尚未发布的草稿必须重新生成后才能确认；已发布的行动和表达保留历史读取，不追溯改写。

## 账号限流与用量配额

配置项位于后端 `limits`，各账号独立统计，测试号同样受限。省略字段使用下列默认值，显式配置必须为正整数，不接受零、负数、小数、文本或 YAML 别名；修改配置后重启 API 生效。

| 配置 | 默认值 | 口径 |
| --- | --- | --- |
| `limits.ai.daily_requests` | 100 | UTC 自然日受理的生成尝试 |
| `limits.ai.minute_requests` | 10 | 滚动一分钟受理的生成尝试 |
| `limits.ai.concurrent_requests` | 2 | 尚未结束、登记未超过两分钟的 pending |
| `limits.media.daily_requests` | 100 | UTC 自然日受理的图片上传 |
| `limits.media.minute_requests` | 20 | 滚动一分钟受理的图片上传 |
| `limits.media.storage_bytes` | 536870912（512 MiB） | 账号受管上传中尚未确认删除的字节总数 |

每日计数在 UTC 00:00（北京时间 08:00）切换；滚动频率窗口包含起始时刻。读取用量、检查领域规则和登记新请求在同一账号数据库事务内执行，多实例共享限额；模型或对象存储网络调用在事务外。

已受理后失败、取消或响应丢失仍计入次数，因为外部服务可能已消耗资源。被拒绝的请求不登记生成、消息或资产，也不调用外部服务。AI 同键同输入先读取原结果，不再消费次数；即使额度已用完仍可读取 pending、成功或失败结果，同键不同输入仍返回 409。确认发布及结果查询不新增生成次数。

图片 pending、上传失败及回收认领中的对象仍占容量，云端删除成功且数据库标记 deleted 后才释放；删除不返还当天上传次数。草稿续期不增加次数或容量。只计有生命周期登记的真实上传，导入的演示资源不占额度。容量不足时，界面删除草稿图片不会立即释放空间，须等待现有回收机制完成。

超限统一返回 HTTP 429、`code: 10006`、中文原因和 `data: null`，前端沿用现有错误显示并保留草稿。此配额限制账号受理次数和存储容量，不是按 token 结算的账单，也未设置整个平台的费用预算。

## 前端与部署边界

前端默认关闭 MSW，Vite 只将 `/api` 转发到 `API_PROXY_TARGET`。密钥保存在被 Git 忽略的服务端配置或 `DEEPSEEK_API_KEY` 环境变量中，没有个人 key 配置，也不注入前端构建。服务端 AI 配置使用 `ai.draft_model` 和 `ai.analysis_model`，分别控制行动整理和表达／约定／来源约定核验；未设置时均使用 `deepseek-flash`，行动整理关闭 thinking，分析和核验开启 thinking。旧配置中的 `ai.model` 仍可读取，但不会覆盖新的默认模型。

登录、退出、账户安全成功及统一 401 边界清理旧账号查询；保留活跃会话查询订阅。网络／数据库错误不能被视为匿名或退回模拟数据。真实响应 ID 为 UUID；导入记录可带显式 `legacyId` 用于旧 hash 链接和本地草稿定位，不能自行推算别名。

MSW 仅在显式开发开关下提供固定生成替身及业务确认契约，不模拟真实邮件、账户安全、对象存储或服务端用量配额；未覆盖请求应失败。当前目录和图上下文仍整体读取，尚未实现远端分页。账号配额不代表已经完成全平台费用控制、容量规划或生产验收。
