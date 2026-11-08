# 真实后端写入契约

状态：当前已实现的业务写入规则。认证、响应外壳和错误码见 [请求契约](api-request-contract.md)，图片和 AI 的 DTO 见 [外部能力契约](backend-external-contract.md)。前端只提交确认参数，不能直接伪造 AI 文稿、对话或作者身份。

## 通用规则

- 写入使用 POST 和 JSON；认证、响应外壳、错误码见 [请求契约](api-request-contract.md)。
- 请求不能指定操作者；事务内重新检查账户状态和认证版本。
- 图、节点、资产和生成任务使用小写 UUID；不接受短 ID、别名或非 UUID 资源标识。
- `graphs/create`、`actions/create` 和 `ai/generate` 携带 UUID 格式的 `Idempotency-Key`。服务端按账号 + 操作 + key 隔离；同键同内容重放第一次结果，同键不同内容返回 409／10005。结果至少保留 24 小时。
- 更新必须携带 `expectedVersion`；版本不符返回 409／10005。资料和精选共用账户版本，图资料独立版本，表达和约定共用节点版本；发布行动不增加图资料版本。
- 写入使用 GORM 事务和 READ COMMITTED 隔离，按账号、凭据、图、对话顺序加锁。图内发布、文档修改、图资料修改和删除共用图行锁。
- 表间只使用 UUID 逻辑关联，不建数据库外键；存在性、归属和删除一致性由用例保证。

## 图

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/graphs/create` | `title`、`description` | `GraphView`，空图，版本 1 |
| `/graphs/update` | `graphUuid`、`expectedVersion`、`title`、`description`、`avatarAssetUuid`、`backgroundAssetUuid` | 更新后的 `GraphView` |
| `/graphs/delete` | `graphUuid`、`expectedVersion`、`expectedNodeCount` | `null` |

- 名称最多 60 个字符，简介最多 240 个字符。
- 创建者和行动贡献数量前三位用户可以修改图资料；没有权限返回 403。
- 头像和背景只能使用当前用户拥有的 ready 资产 UUID；不能传 data URL、第三方 URL 或新引用他人资产。`null` 或省略表示移除图片。
- 图级提示词不开放编辑；`contextGuide` 仅作为历史数据保留，不再通过图设置写入或注入生成提示词。
- 删除要求当前用户是唯一参与者。重新检查资料版本和确认过的行动数量；已有他人参与返回 403，版本或数量变化返回 409。删除只隐藏图并清理关注、精选关系，不级联删除行动和文档。

## 行动发布

`POST /actions/create` 只确认服务端生成结果：

```ts
type CreateActionInput = {
  graphUuid: string
  generationUuid: string
  parentUuid?: string
  mergedParentUuids: string[]
  sourceVersions: { nodeUuid: string; version: number }[]
  referenceAgreements: {
    sourceUuid: string
    complies: boolean | null
    exceptionReason?: string
  }[]
  images: { assetUuid: string; alt: string }[]
}
```

标题、行动正文、表达、后续约定和形成对话全部从 `generationUuid` 指向的服务端记录读取。发布请求不能指定标题、正文、对话、作者、编号或时间。

确认前检查：

- 生成成功且未确认，属于当前提交者和当前图；不能确认他人的草稿，也不能重复使用已确认生成。
- 输入消息和输出完整；生成后本人没有追加新消息。共享对话中的他人私有消息不能进入公开形成过程。
- 生成快照中的来源、版本、表达、约定和核对结果未变化；变化返回 409，要求重新核对或生成。
- 首次行动要求图为空、没有来源；后续行动必须有同图主要来源。
- 来源必须是同图节点；合入来源不能重复、不能在主要来源历史中。最多 50 个直接来源。
- 服务端沿直接来源重建历史并去重，节点编号在图锁内分配，层级为最大直接来源层级加一。
- 每条直接来源必须显式提供 `complies`：`true` 满足、`false` 明确不满足、`null` 未核对。`false` 必须带原因；`true`／`null` 不能带例外理由。
- 不满足或未知不阻止发布，不引入申请、作者批准或管理员审核。
- 表达和约定沿主要来源继承；来源文档缺失时只把对应文档创建为待生成。自己的来源不作为来源约定核对。
- 配图最多 12 张，使用当前用户已就绪的资产；每张备注必填且最多 30 个字符，不能重复。图片必须与生成正文中的占位符一致。

行动、文档状态和版本、引用核对、编号、配图、生成确认和幂等回执在同一事务提交；失败全部回滚，编号不消耗。

## 表达与约定

```ts
type DocumentUpdate =
  | { mode: 'inherit' }
  | { mode: 'clear' }
  | { mode: 'update'; markdown: string }
```

- `update` 正文必须非空，最多 100000 个字符；`inherit`／`clear` 不附带 Markdown。
- 只允许节点作者修改，且节点不能再有后续引用；版本过期或节点已变化返回 409。
- 表达修改必须确认本节点连续对话中的服务端生成结果，不新建行动，不覆盖原始事实。
- 约定可以直接提交文档，也可以确认服务端生成结果；不伪造 AI 对话，不回写已有来源核对。

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/expressions/update` | `nodeUuid`、`expectedVersion`、`generationUuid` | 更新后的 `ActionView` |
| `/agreements/update` | `nodeUuid`、`expectedVersion`、`document`，或 `generationUuid` | 更新后的 `ActionView` |

## 资料、精选与关注

| 路径 | 请求 | 成功 data |
| --- | --- | --- |
| `/profiles/update` | `expectedVersion`、`name`、`gender`、`bio`、`locationCode`、`avatarAssetUuid`、`backgroundAssetUuid` | 当前 `AccountView` |
| `/profiles/highlights-set` | `expectedVersion`、`expressionNodeUuids` | 当前 `AccountView` |
| `/following/set` | `kind`、`targetUuid`、`following` | `FollowingView` |

- 资料只能修改当前账户。昵称最多 32 个 Unicode 码点；简介最多 512 个 Unicode 码点；性别为 `unknown`／`male`／`female`。
- 图片资产规则与图资料相同；资料和精选分开保存，互不覆盖。
- 精选最多 5 个，顺序按数组。只允许本人分支上的非空本人表达；不能精选他人表达、重复节点、已删除图或已清空表达。
- 精选只存节点 UUID，不保存独立约定副本；约定沿主要链读取，并保留实际约定作者。
- 关注必须显式提供布尔值。不能关注自己、不可用用户或还没有行动的图；取消关注允许清理已不可见对象。

## 原子性

创建、发布、文档确认、图删除、资料、精选和关注均在同一业务事务内提交。任一步失败全部回滚；编号、引用核对和幂等回执不会留下半成品。
