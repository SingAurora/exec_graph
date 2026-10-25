# 真实后端写入契约

状态：第三阶段的业务写入和确认用例已实现。真实 AI 生成、上传、邮件认证及前端切换仍属于第四阶段。现有 MSW 发布接口接受浏览器文稿和对话，这是原型协议；真实后端不接受这些字段，不能仅关闭模拟开关就直接联调。

## 通用边界

- 全部路径以 `/api/commands` 开头，使用 POST 和 JSON，响应沿用 `{code, msg, data}`。未知字段由 HTTP 边界拒绝，错误统一转换为中文文案及相应 HTTP 状态。
- 所有业务写入必须携带 HttpOnly 会话 cookie 和 `X-CSRF-Token`。请求不能指定操作者，事务内重新检查账户停用状态及认证版本。
- 图、行动、资产、生成结果都使用规范化的小写 UUID；旧短 ID 仅用于读取演示链接，不接受为写入目标。
- `graphs/create`、`actions/create` 必须携带 UUID 格式的 `Idempotency-Key`。按账号和操作隔离；同键同 DTO 重放原始成功结果，同键不同内容返回 409／10005。结果和业务事实同事务提交，失败不留下成功回执。结果至少保留 24 小时，当前尚未启用过期清理；即使原资源后来被删除，重放也不会重新创建它。
- 更新必须带 `expectedVersion`；过期返回 409。资料与精选共用账户版本；图资料独立版本；表达与约定共用节点版本。发布行动不增加图资料版本，删除另行检查行动数量。
- 写入采用 GORM 事务和 READ COMMITTED 隔离；按提交账号、凭据、图、对话的顺序锁定。图内发布、文档修改、图资料修改和删除共用图行锁，避免检查之后事实又被并发改变。
- 表间只用 UUID 逻辑关联，不建数据库外键。存在性、归属和删除一致性由用例及事务校验。

## 图

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/graphs/create` | `title`、`description` | `GraphView`，空图、版本 1 |
| `/graphs/update` | `graphId`、`expectedVersion`、`title`、`description`、`avatarAssetId`、`backgroundAssetId`，可选 `contextGuide` | 更新后的 `GraphView` |
| `/graphs/delete` | `graphId`、`expectedVersion`、`expectedNodeCount` | `null` |

名称最多 60 个字符，简介最多 240 个字符。创建者及行动贡献数量前三位用户可修改资料；贡献相同时按最早行动时间、作者 UUID 排序。没有该权限返回 403。

新换入的头像与背景使用当前用户拥有的 ready 资产 UUID，不能传 data URL、第三方 URL 或新引用他人资产；已有图图片可以由其他有权限的编辑者保留，不要求转移资产归属。`null` 或省略表示移除该图片。`contextGuide` 省略时保留，空字符串表示主动清空，最多 4000 个字符。

删除要求只有当前用户参与，包括图创建者和全部行动作者。重新检查资料版本和确认过的行动数量；已有他人参与返回 403，数量或版本变化返回 409。删除只将图标为不可见并清理关注、精选关系，不级联抹除行动、文档或形成过程；公开读取不返回已删除图内的内容。

## 行动发布

`POST /actions/create` 的请求字段：

```ts
type CreateActionInput = {
  graphId: string
  generationId: string
  parentId?: string
  mergedParentIds: string[]
  sourceVersions: { nodeId: string; version: number }[]
  referenceAgreements: {
    sourceId: string
    complies: boolean | null
    exceptionReason?: string
  }[]
  images: { assetId: string; alt: string }[]
}
```

成功返回 `ActionView`。标题、行动文稿、表达、后续约定及形成对话全部从 `generationId` 指向的服务端记录读取，不接受发布请求指定 `title`、`objectiveMarkdown`、`conversation`、作者、编号或时间。当前没有可供用户产生该生成结果的真实 AI 接口，第四阶段接入后才构成完整用户发布流程。

确认前检查：

- 生成成功、未确认，属于当前提交者和当前图。发布前对话归当前提交者，不能确认别人的草稿或重复采用已确认生成。
- 对话输入清单、消息序号和输出连续、完整；生成之后没有追加新消息。只有本次实际采用的输入和输出被标记为已确认，进入公开形成过程。
- 图级指引、继承表达、直接来源及其版本、约定版本和核对结果与生成时保存的快照一致。任何变化都返回 409，要求重新核对或生成。
- 首次行动要求图为空、没有来源，表达和后续约定只能明确写入或清空，不能继承。后续行动必须有同图主要来源。
- 合入来源只能是同图其他路线终点，不能重复、不能已在主要来源的历史中；主要来源允许已被引用，以支持分叉。最多 50 个直接来源。
- 服务端沿直接来源重建历史并去重，共享祖先只计一次，无关分支不进入背景。节点编号使用锁定图上的计数器；层级为最大直接来源层级加一。
- 每条来源都必须显式提供 `complies`，省略和 `null` 不等同。`false` 必须有非空理由，`true`／`null` 不附带例外理由。未核对或不满足不阻止发布，不引入批准流程。
- 没有有效约定或明确清空时记录 `unrestricted`；有约定时分别记录 `unreviewed`、`satisfied` 或 `exception`，并固定实际采用的约定版本。
- 过渡 `ActionView.referenceAgreements` 仅返回已经核对的 true／false 记录；没有记录表示未核对。这与当前 UI 模型一致，避免把 null 错当作不满足。数据库四态和发布输入的显式 null 均保留，不能混淆这两种边界。
- 表达和后续约定只沿主要来源继承。合入只提供事实背景，不替代主要链的表达和约定，clear 版本不能被越过。
- 配图最多 12 张，使用当前用户已就绪资产，不能重复；描述最多 500 个字符。

行动、两个文档状态、明确文档版本、引用记录、编号、配图、生成确认、对话发布边界和幂等回执在同一事务提交。任一步失败全部回滚，编号不被消耗。

## 表达与约定

```ts
type DocumentUpdate =
  | { mode: 'inherit' }
  | { mode: 'clear' }
  | { mode: 'update'; markdown: string }
```

`update` 正文必须非空，最多 100000 个字符；`inherit`／`clear` 不附带 markdown。发布已存储的生成可采用 inherit；已有节点修改必须 update 或 clear。

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/expressions/update` | `nodeId`、`expectedVersion`、`generationId` | 更新后的 `ActionView` |
| `/agreements/update` | `nodeId`、`expectedVersion`、`document` | 更新后的 `ActionView` |

保持当前产品规则：任何已登录用户都可以整理尚未被主要承接或合入引用的终点，不额外增加“仅原作者”限制。实际整理者记录在不可变文档版本中，行动作者保持不变。

表达修改必须确认本节点连续对话里的服务端生成结果，且生成基于当前节点版本；不新建行动，不改客观文稿，也不覆盖最初对话。约定修改可直接提交文档，不伪造 AI 对话，不回写已有来源的核对记录。未变化内容、过期版本或已有后续引用均返回 409。

## 资料与精选

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/profiles/update` | `expectedVersion`、`name`、`gender`、`bio`、`avatarAssetId`、`backgroundAssetId` | 当前 `AccountView` |
| `/profiles/highlights-set` | `expectedVersion`、`expressionNodeIds` | 当前 `AccountView` |

资料只能修改当前账户。昵称最多 30 个字符，简介最多 1000 个字符，性别为 `unknown`／`male`／`female`；图片的资产规则与图资料相同。资料和精选各自保存，不覆盖另一部分。

精选最多五个，顺序以数组为准，空数组表示清空。只允许本人分支上的非空本人表达；本人行动继承本人的表达，或本人整理并确认的表达，都可选择。不能精选他人的表达、重复节点、已删除图或有效表达已清空的节点。

精选存具体节点 UUID，不保存独立约定副本；约定按所选节点主要链读取，保留实际约定作者。下游新增或分叉不会自动移动所选节点。表达被清空、归属改变或图被删除后，公开读取过滤不可用条目；删除图时同时清理其精选关系。

## 关注

`POST /following/set` 接收 `{kind: 'user' | 'graph', targetId: UUID, following: boolean}`，返回 `FollowingView`。

必须显式提供布尔值，重复设置同一状态不产生重复记录。不能关注自己、不可用用户或还没有行动的图。取消关注允许清理已不可见对象。关注图不等于关注图内所有用户。

## 验证与前端迁移

真实 MySQL／Redis 的 HTTP 集成测试覆盖上述写入，另在引用记录写入阶段注入失败，检查节点、编号、生成确认和回执共同回滚。并发测试覆盖同提交重复创建、不同用户同时创建起点、同版本文档修改，以及发布与来源修改竞态。

生成确认测试使用带 `integration-fixture` 标记的服务端夹具，不构成真实 AI 验证，也没有运行时生成后门。所有测试库和会话前缀随机隔离；测试完成删除自己的库及会话。

前端已在读取边界把 `graphId` 映射为 UI 的 `projectId`，关注模型也已使用 `graphIds`。后续联调主要需要真实登录生命周期、资产上传及 UUID 引用、AI 生成／确认 DTO，以及关闭 MSW 后的浏览器回归；不回退到演示数据。
