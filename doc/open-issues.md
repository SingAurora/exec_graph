# 未收口问题清单

状态：待处理，后续按优先级逐项修复。本文不是接口契约，也不是实施计划；修复完成后删除对应条目，避免文档再次漂移。

记录时间：2026-11-01。基于提交前的 `main@81eb215` 与当时未提交的 AI 生成改动（`messages[]` 批量输入、行动整理关闭 thinking、核验规则 v3）。这些改动和本文一起提交，具体差异见 git 历史。

编号按发现顺序分配，总览表按优先级排序；后续新增条目不重排旧编号。

产品方向（2026-11-01 确认）：行动通过连续 AI 对话逐步整理，用户对草稿满意后再点击“发布行动”。因此允许对话回合更新草稿；问题不是“重新生成”本身，而是每次更新必须让用户看见变化，并在发布前明确最终版本。只读复核可以作为可选交互，不作为唯一方案。

## 优先级总览

| 编号 | 优先级 | 问题 | 用户可见影响 |
| --- | --- | --- | --- |
| OI-1 | P0 | 行动「批量输入」只有后端，前端仍逐条发送 | 文档描述的“整理行动”交互不存在 |
| OI-2 | P0 | 约定工作区不展示生成后的约定草稿 | 用户无法预览 AI 结果，只能盲存 |
| OI-3 | P0 | MSW 不支持 `agreement` 生成与 `generationId` 确认 | 模拟环境下约定工作区不可用 |
| OI-10 | P0 | 行动对话更新草稿时没有可见变化与最终确认 | 可能发布未审阅的版本 |
| OI-4 | P1 | 确认约定时多传 `document: { mode: 'clear' }` | 目前被后端忽略，语义危险 |
| OI-5 | P1 | 多处文档仍描述 schema v2、全量 thinking、静态原型 | 误导后续实现与验收 |
| OI-6 | P1 | 三个工作区的 tab 与设计文档不一致 | 工作区无法只读查看另外两类文档 |
| OI-11 | P1 | 行动回复只有一句“已记录”，首次行动无独立核验 | 无法从对话判断结果，主观结果缺少守卫 |
| OI-12 | P1 | AI 澄清提示只保留在本地草稿，未进入服务端上下文 | 下一轮模型看不到自己的提问，跨设备会丢失 |
| OI-7 | P2 | 遗留原型代码岛未清理 | 增加维护与 lint/测试噪音 |
| OI-8 | P2 | 目录与图上下文整体读取、窄屏未适配 | 数据量增长后不可用 |
| OI-9 | P2 | 生产主包约 1.59 MB | 首屏加载成本偏高 |

---

## P0

### OI-1 行动批量输入的 UI 未落地

**现状**

- 后端 `GenerateInput` 已改为 `messages: string[]`，每条最多 500 字、最多 50 条、合计 10000 字；每条写入 `ai_messages`，生成记录保存 `InputThroughSequence`。
- 前端 [ActionWorkspace.tsx:111](../frontend/src/widgets/ai/ActionWorkspace.tsx#L111) 每次点击发送仍然提交 `messages: [clean]`，没有“先在本地收集、再批量整理”的第二步。
- [workspace-draft.ts:18](../frontend/src/widgets/ai/model/workspace-draft.ts#L18) 的 `pendingReports` 除恢复旧草稿外没有写入点；`canPublish` 却要求 `!input.trim()`（[ActionWorkspace.tsx:85](../frontend/src/widgets/ai/ActionWorkspace.tsx#L85)），说明交互按“输入框里还有未整理报告”设计。
- 对外契约 [backend-external-contract.md:88](backend-external-contract.md#L88) 已写成“点击‘整理行动’后批量提交”。

**影响**

文档与真实界面不一致；如果后续只保留逐条发送，`messages[]`、`pendingReports` 和发布条件都会成为半成品。

**收口方式（二选一）**

1. 实现批量交互：发送按钮只把本轮报告追加到本地待整理列表，新增“整理行动”按钮一次性提交全部待整理消息；失败保留报告，成功后清空待整理列表。同步补组件测试。
2. 回退为单条发送：契约和文案改回单条，删除 `pendingReports`、`AIMessageBatchLimit` 及 `messages[]` 的批量语义，避免留下没有入口的能力。

无论选哪条，都要同步更新 [backend-external-contract.md](backend-external-contract.md) 和 [project-detail-ui-design.md:208](project-detail-ui-design.md#L208) 的描述。

**验收**

- 发送后不会在用户只写了一段话时意外调用模型，或按最终选定的交互明确调用一次。
- 刷新页面后待整理内容仍能恢复；发布成功或明确丢弃后才清除。
- 生成失败保留输入，且不会因为输入框非空而出现“待发布却不可点”的无解释状态。

---

### OI-2 约定工作区不展示生成后的约定草稿

**现状**

- [AgreementWorkspace.tsx:97](../frontend/src/widgets/ai/AgreementWorkspace.tsx#L97) 的“约定”tab 渲染的是当前已发布约定 `agreement.markdown`，不是本轮生成的 `draftDocument`。
- 同一文件的 `markdown = draftDocument ?? agreement.markdown` 只用于底部“待保存/约定未变化”判断，用户看不到新草稿全文。
- 保存按钮依赖 `generation.updateAgreement`，确认后直接写库，容易在未读新内容的情况下保存。

**影响**

生成成功的约定无法预览、复制或核对；AI 对话与最终保存之间缺少可审阅的文档视图。

**收口方式**

- 约定 tab 改用 `markdown`（草稿优先），保留“当前已发布约定”作为对照或来源提示，而不是替换草稿。
- 若本轮 `mode` 为 `clear`，明确显示“将清空约定”，不要用空正文静默伪装成未生成。
- 顺带给 `AgreementWorkspace` 使用独立的草稿校验器；当前复用了 `isExpressionWorkspaceDraft`，后续字段分叉时容易漏校验。

**验收**

- 生成一条新约定后，约定 tab 显示新全文；点击保存前即可阅读完整 Markdown。
- 生成“清空”时明确展示清空意图。
- 失败或未生成时不显示上一轮旧草稿冒充本轮结果。

---

### OI-3 MSW 不支持约定生成与 `generationId` 确认

**现状**

- [mocks/generation.ts:15](../frontend/src/app/mocks/generation.ts#L15) 只接受 `mode === 'action' || mode === 'expression'`。
- [mocks/actions.ts:64](../frontend/src/app/mocks/actions.ts#L64) 的 `agreements/update` 只允许 `document`，不接受 `generationId`。
- 真实后端已支持 `mode: 'agreement'`，也支持 `agreements/update` 携带 `generationId`。

**影响**

显式开启 `VITE_ENABLE_API_MOCKS=true` 时，新增的约定工作区无法生成或保存；与“MSW 沿用真实契约”的约定冲突。

**收口方式**

- 在模拟生成中支持 `mode: 'agreement'`：返回 `draft.agreement` 和 `updateAgreement`，拒绝来源列表与表达字段。
- `agreements/update` 接受 `nodeId`、`expectedVersion`、`generationId`（与真实 DTO 对齐），并校验生成属于当前节点和版本。
- 补模拟契约测试：约定生成、确认、节点版本冲突、重复确认。

**验收**

- 关闭 MSW 前后，约定工作区的请求与响应结构一致。
- 同一 `generationId` 不能重复确认；过期版本返回 409。

---

### OI-10 行动对话更新草稿时没有可见变化与最终确认

**现状**

- 按当前产品方向，[ActionWorkspace.tsx:106](../frontend/src/widgets/ai/ActionWorkspace.tsx#L106) 每次发送都重新整理是合理的；问题在成功后 [ActionWorkspace.tsx:128](../frontend/src/widgets/ai/ActionWorkspace.tsx#L128) 直接用新的 `draft.objective` 覆盖当前文档，没有差异摘要或“本次更新了什么”的提示。
- 两轮之间没有“确认采用这一版”的步骤。发布按钮只要求最后一次生成的 `generated` 和 `generation.createAction`（[:85](../frontend/src/widgets/ai/ActionWorkspace.tsx#L85)），因此用户可能发布自己没重新看过的版本。
- 生成成功后在对话里只追加一句 `reply`，没有“查看草稿”入口；正文只在“行动”tab。
- 每次受理都计入账号生成配额；这是连续对话的预期成本，但界面没有让用户意识到“这一轮又生成了一次”。
- 首次行动没有来源，也不会触发独立核验（见 OI-11）。
- AI 回复“已记录本次战役行动”容易让人以为已经发布；实际上只有点击“发布行动”才写库。

**影响**

连续对话的方向是对的，但用户无法确认自己满意的是哪一版草稿，也无法确认点击发布会写入当前显示的版本；“已记录”和“已发布”的语义不一致。

**收口方式**

- 保留“对话反复整理，满意后发布”的主流程；每次成功后展示草稿标题、摘要或变更点，并标记“草稿已更新”，不要静默替换。
- 在对话里提供“查看行动草稿”入口；发布前展示当前草稿摘要，确保“看到的”就是“要发布的”。
- 如果用户只是问“可以吗”，允许 AI 只回答、不修改草稿；如果这一轮确实修改了草稿，必须显式展示修改结果。只读 `review` 模式可以作为可选的实现方式，不是唯一方案。
- 把“已记录”改为“已整理成草稿，确认后发布”，并在发布成功后再使用“已发布”。
- 批量输入时不要把纯确认问句当成本轮行动报告；如果无法可靠区分，至少让用户看到它被当成了什么。

**验收**

- 每轮对话后，用户能看到当前草稿以及这一轮是否改变了它。
- 发布写入的版本与发布前展示、用户确认的版本一致，不会在后台换成另一版。
- 纯确认问句可以只得到回答而不改变草稿；若改变，变化必须可见。
- 对话文案区分“草稿”和“已发布”。

---

## P1

### OI-4 确认约定时多传 `document: { mode: 'clear' }`

**现状**

[App.tsx:249](../frontend/src/app/App.tsx#L249) 在已有 `generationId` 的情况下仍传 `document: { mode: 'clear' }`。真实后端在当前实现中会忽略 `document`，所以没有立刻出错，但这是依赖实现顺序的隐式行为。

**影响**

一旦后端调整校验顺序或优先使用 `document`，用户点击“保存约定”会被保存成清空。模拟接口则直接因为多出字段拒绝请求。

**收口方式**

删除该字段，只提交 `{ nodeId, expectedVersion, generationId }`；`reviseAgreement` 的类型已经是可选的 `document?`，不需要伪造占位。补一条契约测试，确认确认请求只包含服务端返回的参数。

**验收**

真实后端与模拟接口都能接受同一个请求体；保存后约定等于生成的 Markdown，而不是空字符串。

---

### OI-5 文档与实现漂移

以下位置描述已过期，修复对应实现后同步修改：

| 位置 | 过期内容 | 当前事实 |
| --- | --- | --- |
| [backend/README.md:177](../backend/README.md#L177)、[:189](../backend/README.md#L189) | “schema v2”“当前仍为 schema v2” | 当前为 schema v4 |
| [backend-implementation-plan.md:114](backend-implementation-plan.md#L114)、[:131](backend-implementation-plan.md#L131) | 阶段 4/5 仍写 schema v2 | v4 增加了独立 AI 对话类型与约定生成字段 |
| [config.example.yaml:51](../backend/etc/config.example.yaml#L51) | “行动、表达、约定及独立核验统一使用 Pro，并开启 thinking” | 行动整理默认关闭 thinking，分析和核验开启 |
| [backend-implementation-plan.md:119](backend-implementation-plan.md#L119) | “前端全量测试 307 项” | 当前 320 项通过 |
| [project-detail-ui-design.md:3](project-detail-ui-design.md#L3) | “当前 frontend 为静态原型，真实发布与 AI 背景校验仍需后续接入” | 真实发布、上传、生成和确认已接入 |
| [backend-write-contract.md:81](backend-write-contract.md#L81) | `agreements/update` 只列 `document` | 还支持 `generationId` 确认服务端生成 |
| [global-ui-design.md:48](global-ui-design.md#L48) | “静态原型中的已发布数据仍沿用会话内状态” | 真实业务写入已落库 |

**收口方式**

- 先确定 schema 版本口径：`LatestSchemaVersion` 已是 4，README 与阶段计划应写“v4 起”，历史阶段记录可保留当时版本但加注“已被 v3/v4 取代”。
- 配置示例注释改为“行动整理默认关闭 thinking；表达、约定和来源核验开启”。
- 测试数量这类易漂移的数字，建议改成不写具体条数，只写“全量测试通过”。
- 写入契约补 `generationId` 的适用条件、校验和失败行为。

**验收**

按文档就能复现当前接口和数据库版本，不再出现“文档说 v2、代码要求 v4”的情况。

---

### OI-6 三个工作区的 tab 与设计文档不一致

**现状**

- [ActionWorkspace.tsx:141](../frontend/src/widgets/ai/ActionWorkspace.tsx#L141)：`['conversation', 'objective']`
- [ExpressionWorkspace.tsx:96](../frontend/src/widgets/ai/ExpressionWorkspace.tsx#L96)：`['conversation', 'objective', 'expression']`，但传入了 `agreement` 内容却没有对应 tab。
- [AgreementWorkspace.tsx:87](../frontend/src/widgets/ai/AgreementWorkspace.tsx#L87)：`['conversation', 'objective', 'agreement']`，但传入了 `expression` 内容却没有对应 tab。
- [project-detail-ui-design.md:206](project-detail-ui-design.md#L206) 仍写“AI 对话 / 行动 / 表达 / 约定”四个 tab，且“工作区可只读查看另外两类文档”（[:172](project-detail-ui-design.md#L172)）。

**收口方式（二选一）**

1. 给表达、约定工作区补上缺失的只读 tab，并让 `WorkspaceFrame` 只渲染实际存在的文档。
2. 明确产品决定“每个工作区只显示本类型文档 + 行动”，同步修改设计文档，删除未挂载的 `expression` / `agreement` 预览内容，避免死参数。

**验收**

工作区 tab、可切换文档和设计文档三者一致；没有“传了内容但永远看不到”的组件参数。

---

### OI-11 行动回复概括与首次行动核验

**现状**

- 对话区只显示 `draft.reply`（[WorkspaceFrame.tsx:149](../frontend/src/widgets/ai/WorkspaceFrame.tsx#L149)），`objective` 只在“行动”tab（[:160](../frontend/src/widgets/ai/WorkspaceFrame.tsx#L160)）。已发布行动的旧回复只有“已记录本次战役行动”。
- 2026-11-01 已按产品决定修改生成规则：action 模式的 `reply` 只需用一两句话概括本轮整理，并提示到“行动”tab 查看完整草稿；不复述标题、正文或逐项细节，也不能只写“已记录”。expression、agreement 模式说明改动或清空并指向对应 tab。旧记录保留当时的回复，不会因提示词更新回溯改写。
- 首次行动（无来源）在 [service.go:136](../backend/internal/application/generation/service.go#L136) 跳过独立核验；行动草稿默认使用非 Thinking 模型（[client.go:36](../backend/internal/infrastructure/ai/client.go#L36)）。用户报告里的“难度不高、可以容易拿到三星”属于主观判断或预测；如果正文写成“拿到了三星”，当前路径没有第二道检查。
- 用户问“可以吗”时，模型回答“可以”，这是模型对自己的草稿做确认，不是独立核验，容易过度附和。

**影响**

对话只是摘要，细节需要切到行动 tab 核对；这是有意的产品分工，不是缺陷。首次行动的主观／结果边界没有独立保障；确认回合得到的是“自我批准”，不是可核对的事实说明。

**收口方式**

- `reply` 契约已按“概括 + 指向 tab”调整；仍需观察模型实际遵守情况。已经发布的短回复不回填；完整正文仍在形成过程的文档结果中读取。
- 可选地在回复旁提供“查看行动”入口，方便用户从对话跳到文档；保持 tab 不自动切换。
- 对首次行动增加轻量守卫：至少对“拿到了 / 获得了 / 完成了”等结果性表述做规则检查，确认报告里真的报告了结果；更稳妥的是对首次行动也运行一次核验，或在成本敏感时只对包含主观／结果声明的草稿运行。
- 对“可以吗”这类复核问题，要求模型指出自己只能核对摘要、细节以行动 tab 为准，不能简单说“可以”或替用户确认正文。

**验收**

- 对话回复能概括本轮整理并引导到行动 tab，不复述完整正文。
- 一段包含“容易拿三星”的报告，如果草稿写成“拿到了三星”，必须被拒绝或降级为主观表述。
- 复核回复不再出现无依据的“可以 / 没问题”。

---

### OI-12 AI 澄清提示只保留在本地草稿，未进入服务端上下文

**现状**

- 2026-11-01 已修前端：业务性失败（如“请补充这次实际做了什么”）现在通过 `appendWorkspaceNotice` 作为正式 AI 消息保留在 IndexedDB 草稿中；只有网络、超时等临时错误继续用 `appendWorkspaceError` 替换。下一轮发送不会再清掉上一轮的 AI 提示。
- 但后端仍把“无标题/无正文的行动输出”当作 `content_invalid` 失败（[prompt.go:162](../backend/internal/application/generation/prompt.go#L162)），只返回通用错误，不保存模型自己的 `reply`；失败的生成没有 `output_message_uuid`，下一次 `Conversation` 读不到这条 AI 提示。
- 因此：下一轮模型不知道它已经问过；换浏览器或清掉草稿后记录消失；发布成功后本地草稿被清除，公开形成过程也不会包含这条提示。
- 公开形成过程不包含失败轮次本身符合“只公开实际采用生成”的现有设计，但“私聊记录是否要跨设备保留”仍是未决产品问题。

**影响**

对话连贯性不足，模型可能重复问同一个问题；用户以为“记录”已保存，实际只在当前浏览器的本地草稿里。

**收口方式**

- 后端为“澄清/业务拒绝”设计一个合法回合：保留模型 `reply`，写入 `ai_messages`，并能在私有 `Conversation` 中读回；可选新增 `clarification` 状态，或允许失败生成关联一条 output 消息。
- 下一轮生成上下文必须包含该 AI 消息；不能把浏览器本地提示当作 user 消息回传，否则会污染报告归属。
- 明确公开边界：失败的澄清默认不进入公开形成过程；如果产品要求公开，单独设计确认和隐私规则。
- 若要求跨设备恢复，需要补未发布对话的私有读取接口；当前工作区只靠本地草稿。

**验收**

- 同一对话下一轮模型能看到上一轮的 AI 澄清，不重复问同一个问题。
- 刷新或换设备后，未发布对话仍能读到 AI 提示（如果产品要求跨设备草稿）。
- 发布后的公开形成过程只包含确定采用的生成消息，不因本次修复泄露失败轮次。

---

## P2

### OI-7 遗留原型代码岛

以下模块目前没有运行时入口，形成孤立引用岛，清理前需区分“仅测试使用”和“仅类型依赖”：

- `MyPage` / `PersonalArea` / `PersonalWorkspace`：`App` 已改用 `ProfilePage → PublicProfile`。
- `NodeArchivePage`：已被 `ActionArchivePage` 取代。
- `TopicPage` → `CompletionPost` / `BranchOverview` / `RecordList`：旧主题和旧帖子模型。
- `AIWorkspace` 与 `features/ai-key`：`AIWorkspace` 无入口；`features/ai-key` 仍被 [workspace-draft.ts](../frontend/src/widgets/ai/model/workspace-draft.ts) 引用两个类型。
- `app/model/delete-project.ts`、`features/action-agreement/ui/EditAgreement.tsx` 等旧兼容函数和编辑器。

**收口方式**

先删除只有测试引用的旧组件和测试，再把 `workspace-draft.ts` 依赖的 AI 类型迁到 `entities/action/model/` 或 `features/action-generation/model/`，最后删除 `features/ai-key`。保留 `legacy-types.ts` 仅用于旧兼容读取，按 AGENTS.md 的例外规则处理。

**验收**

`grep` 不再出现无入口组件；`bun run lint`、`bun run test` 和 `bun run build` 仍通过，旧 hash 链接和本地草稿键不受影响。

---

### OI-8 目录与图上下文整体读取、窄屏未适配

**现状**

[useAppResources.ts](../frontend/src/app/model/useAppResources.ts) 启动时读取全部图目录，再对每张图调用 `actions/context`，前端在完整数据上计算列表、搜索和图布局。文档已把它标为过渡方案（[api-request-contract.md:206](api-request-contract.md#L206)）。窄屏布局也仍是固定桌面侧栏。

**收口方式**

- 先实现摘要流（表达、行动、约定回应）和按需详情/拓扑读取，再做搜索分页；不要把本地切片包装成服务端分页。
- 移动端单独做导航和画布适配，不与分页重构混在同一次变更里。

**验收**

图数量增长后首屏不会请求所有图的完整上下文；窄屏下侧栏、图名片、探索工作区不挤压内容。

---

### OI-9 生产主包约 1.59 MB

**现状**

`bun run build` 输出主 JS `1,593.11 kB`（gzip `494.23 kB`），Vite 提示超过 500 kB。主要体积来自 Cytoscape 和 dagre。

**收口方式**

按路由/工作区动态导入探索画布和 AI 工作区；或配置 `manualChunks` 把图引擎拆成独立 chunk。不要为了体积删除图能力或把业务数据塞进打包产物。

**验收**

首屏主包明显下降，探索页首次进入仍可用；构建不再出现 500 kB 警告，或明确接受并记录原因。

---

## 已验证、无需重复怀疑

以下在 2026-11-01 的工作区实测通过，修复上述问题时作为回归基线：

- 后端：`go build ./...`、`go test ./...`、`go vet ./...` 通过；`gofmt`、`git diff --check` 无问题。
- 前端：`bun run lint`、`bun run test`（330 项、71 个文件）、`bun run build` 通过。
- 未执行：`EXEC_GRAPH_INTEGRATION=1` 的真实 MySQL／Redis／云服务回归。涉及生成事务、配额、媒体回收或迁移的改动必须补跑。
- 未验证：浏览器窄屏、真实 AI 生成、真实对象存储上传。它们仍按各自显式开关单独验收。

## 维护约定

- 修复一项就删除或勾掉对应条目；不要把已完成项留成“历史记录”，历史由 `git log` 承担。
- 新增问题优先写清“现状 → 影响 → 收口方式 → 验收”，没有证据的猜测不要写入。
- 如果问题变成长期产品决策（例如“是否保留批量输入”），把它移到对应设计文档，本文只保留执行项。
