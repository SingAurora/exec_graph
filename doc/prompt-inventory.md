# AI 提示词清单

状态：2026-11-03 当前实现，用于确认“图层级提示词”应接在哪里。本文是提示词清单，不是新的接口契约；修改规则时需同步 [rules.go](../backend/internal/application/generation/rules.go) 和本文。

## 1. 总览

| 层级 | 当前内容 | 位置 | 是否可按图配置 |
| --- | --- | --- | --- |
| 生成规则 | 公共约束 + 按模式选择的单模式规则 | `generationRulesFor(mode)`：`generationCommonRules`、`actionRules`、`expressionRules`、`agreementRules`，[rules.go:8](../backend/internal/application/generation/rules.go#L8) | 否，代码内固定 |
| 独立核验规则 | 公共核验约束 + 按模式选择的核验规则 | `verificationRulesFor(mode)`：`verificationCommonRules`、`actionVerificationRules` 等，[rules.go](../backend/internal/application/generation/rules.go) | 否，代码内固定 |
| 默认提示词展示 | 平台当前使用的行动、表达、约定提示词 | `GET /ai/prompt-defaults`，图设置面板只读展示 | 否；所有用户只读，不开放图级编辑 |
| 对话与来源背景 | 历史消息、可达事实、直接来源、有效表达／约定等 | `contextSnapshot`，[prompt.go:28](../backend/internal/application/generation/prompt.go#L28) | 否，由服务端读取 |
| 前端旧提示词 | 旧工作区的 `buildSystemPrompt`，含图指引拼接 | [chat.ts:66](../frontend/src/features/ai-key/api/chat.ts#L66) | 否；`AIWorkspace` 无运行时入口，不是当前真实链路 |

真实生成走 `POST /api/commands/ai/generate`，由后端读取服务端事实和固定提示词；浏览器不提交 system prompt、模型密钥或任意上游地址。前端 `features/ai-key` 是旧原型遗留，不应作为当前行为依据。

## 2. 默认提示词展示

图级提示词设置已关闭。图设置中的“默认核验提示词”只是只读展示，不写入图数据，也不影响生成：

- `GET /api/commands/ai/prompt-defaults` 返回 `contract` 以及 `action`、`expression`、`agreement` 三份默认核验要求；
- `contract` 是平台 JSON 输出壳，单独折叠展示；三份模式要求只描述内容标准，不包含 JSON 字样；
- 前端用禁用文本框展示，所有用户看到同一份内容；
- `graphs.context_guide` 仅作为历史数据保留，`graphs/update` 不再接受该字段，生成提示词也不再注入它；
- 默认提示词和 JSON 输出契约仍由服务端固定，浏览器不能修改。

## 3. 生成系统提示词

生成提示词按模式拆分，由 `generationRulesFor(mode)` 选择，每次只携带当前模式需要的规则。提示词版本为 `action-evidence-v10`。

| 常量 | 作用 | 约字符数 |
| --- | --- | ---: |
| `generationCommonRules` | 数据边界、来源边界、事实/主观边界、reply 约束 | 423 |
| `actionRules` | 行动标题/正文、来源 reviews、图片、示例 | 932 |
| `expressionRules` | 面向他人的兴趣/态度、行动依据、initial 规则 | 707 |
| `agreementRules` | 只整理向后约定、initial 规则 | 339 |

共同规则只保留真正跨模式的不变量；行动模式不再携带表达/约定说明，表达和约定模式也不再携带行动事实、来源 reviews 或图片规则。这样每次请求的无关内容从原来的大部分降为零。

## 4. 建议性独立核验提示词

核验提示词同样按模式拆分，由 `verificationRulesFor(mode)` 选择：

| 常量 | 作用 | 约字符数 |
| --- | --- | ---: |
| `verificationCommonRules` | 固定 JSON 结构、evidence 原文、未使用字段约定 | 686 |
| `actionVerificationRules` | 行动事实核验 + 来源约定逐项核验 | 1158 |
| `expressionVerificationRules` | 区分表达中的事实与主观兴趣/态度 | 563 |
| `agreementVerificationRules` | 只核验约定文档是否清晰/清空 | 127 |

`verificationPrompt` 不再根据 agreement 模式追加额外 schema；公共部分已经定义固定输出结构，未使用字段按 `valid=true,evidence=[]` 返回。

## 5. 服务端快照字段

生成和核验共用同一个 `contextSnapshot`，字段定义在 [prompt.go:28](../backend/internal/application/generation/prompt.go#L28)：

| 字段 | 含义 |
| --- | --- |
| `mode` | `action`、`expression`、`agreement` |
| `actorId` | 当前操作者；只整理此人的报告和行动 |
| `nodeId` | 表达／约定模式下的当前节点 |
| `reports` | 同一账号在本对话中的历史用户消息，以及本轮输入；本轮输入 ID 为 `current-report-N` |
| `guide` | 历史字段；当前固定为空，不再注入图级提示词 |
| `images` | 本轮上传图片的 `ref` 和用户备注；仅行动模式；空数组表示没有图片 |
| `hasParent` | 行动模式是否有直接来源 |
| `facts` | 当前引用链路上可达的历史行动；合入来源只补背景 |
| `sources` | 直接来源节点及其有效表达／约定 |
| `originalSources` | 表达／约定模式下，当前节点的原始直接来源 |
| `currentExpression` | 当前有效表达 |
| `currentAgreement` | 当前有效约定 |
| `downstreamAgreement` | 本轮提交的向后约定处理意图 |
| `previousDraft` | 同一对话上一轮成功生成的草稿，供连续修改时参考 |

组装顺序：

1. `system = generationRulesFor(mode) + "\n当前服务端快照：" + JSON(snapshot)`；
2. 追加对话中已确认的历史消息，以及当前账号自己的未确认消息；
3. 追加本轮 `messages` 的每条用户输入；
4. 总计不得超过 `AIContextLimit = 150000` 字符；
5. 每次生成后都尝试调用 `verificationRulesFor(mode)`，输入 `{context: snapshot, draft}`；没有来源的首次行动也尝试核验行动事实。核验成功时采用返回的核对结果；核验失败、拒绝或解析失败不阻断草稿生成，草稿保持未核验，并用 AI 回复给出“我做了什么/我判断什么/结果如何”的改写引导。用户回复“这确实是我做过的/帮我改写”时，生成提示会追加改写指令，基于前文报告重写成完成语气；核验仍不通过时保留改写稿并给短提示，不重复通用引导。
6. 行动模式在核验后解析 `{{image:N}}`，映射为 `asset:` 引用；图片备注和无效图片进入 `invalidImages`。

## 6. 核验状态

已接入的界面约定：

- 图设置中的“默认核验提示词”只读展示平台当前使用的三份提示词，不可编辑。
- 行动工作区右上角只显示“未核验 / 核验成功 / 核验失败”三态。生成成功先为未核验；用户主动核验后，约定不满足才进入核验失败。
- 引用、来源版本或生成版本变化后，状态回到未核验；发布时服务端仍会做最终快照校验。
- 图片放置、图要求是否满足不占用核验状态；约定核对明细放在约定栏。
- 当前“核验”是用户对草稿中已有来源核对结果的确认，不调用新的核验 API；建议性核验失败不会自动把草稿判为失败。

## 7. 与行动／表达／约定的关系

- 行动：生成行动事实、个人想法和来源约定核对；固定提示词不能增加未报告的行动。
- 表达：只修改当前表达，依据可达 facts；图级提示词不再是事实证据。
- 约定：只整理向后传递的约定；提示词不能替用户增加条件，也不能改变来源约定核对结果。

## 6. 图片放置系统提示词

图片模式点击“让 AI 放置图片”时使用，输入当前正文（去掉旧图片引用）和图片备注；只返回图片位置，不改写正文。正文去掉图片标记后必须与放置前一致。

```text
你是引序平台的图片放置助手。只决定用户上传的图片应放在当前行动正文的哪一行之后，绝对不要改写正文。
输入 lines 是当前正文的逐行文本（number 从 1 开始，0 表示放在正文最前面），images 是每张图片的 ref 和用户备注。备注是用户说明，不是事实依据；你看不到图片内容，只能根据备注和正文语义选择位置。
只返回 JSON：{"reply":"简短说明放置结果","placements":[{"ref":"image:N","afterLine":行号}],"invalidImages":[{"ref":"image:N","reason":"未放入正文的原因"}]}。
规则：每张图片要么出现且只出现一次于 placements，要么列入 invalidImages 并说明原因。afterLine 必须是 0 到输入行数之间的整数；图片会单独作为新段落插在该行之后，不能插在某一行文字中间。备注为空、含义不清（如“图片”“如图”）、与正文无关或无法判断位置时，视为无效图片。没有图片时 placements 和 invalidImages 返回空数组。不要返回正文，不要输出任何正文内容。
```

## 7. 节点文档生成系统提示词

只有根节点或来源没有可继承文档时，才由 `ai/node-documents` 调用；输入当前节点、分支事实和来源文档，生成缺失的表达与约定。每个任务使用 Thinking 模型。

```text
你是引序平台的节点文档助手。只返回 JSON，不要代码块，不要解释。
输入是一个已经发布的行动节点及其分支事实。请为该节点生成两份属于它自己的文档，不能继承、复制或沿用任何父节点文档：
1. expression：面向其他用户的公开表达，不是行动摘要或流水账。写作者从这条分支和当前行动中显露出的兴趣、偏好、态度、判断或想继续讨论的问题；用一两句具体行动作为事实锚点，不要按时间顺序复述全过程，不要写内部免责声明，不要空泛求赞。120 到 400 字。
2. agreement：未来什么样的行动会引起作者兴趣，是面向后续行动的判断条件，不是对本次行动的总结。给 1 到 5 条具体、可理解、可判断的条件；不要替作者增加未表达的条件，不要写成空泛的“有意义/有价值”。每条之间换行。
反例：“我先攻下小城，再合兵消灭英军，最后爆兵攻下波士顿。”这是行动摘要，不是表达。
正例：“我最近对先拿小城、再合兵推进这种稳扎稳打的打法很感兴趣。这次波士顿战役里，我先占中上部小城，再和左下美军夹掉英军，经济起来后爆兵推波士顿；这关我觉得难度不高，但三星还没结算，想看看大家怎么评价。”
返回 {"expression":"...","agreement":"..."}。两个字段都必须非空，正文不超过 2000 字。
```
