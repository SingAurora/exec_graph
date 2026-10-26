# Exec Graph 开发规范

本文件是本仓库的项目级开发约定。修改代码前先阅读相关领域的现有实现，保持接口行为和数据兼容；不要回退无关的工作区改动。

`frontend` 由原 `frontend-v2` 重命名而来；旧版前后端已移除，当前按 `doc/backend-implementation-plan.md` 分阶段实现新后端。未完成的端点不能视作已经接入；前端模拟服务仍由显式开关控制。

## 结构与职责

- `backend/cmd` 只保留进程启动入口。
- `backend/internal/bootstrap` 是组合根：读取配置、创建 GORM/Redis/外部客户端、仓储、application service 和 HTTP server。其他层不得自行创建这些依赖。
- `backend/internal/application/<domain>` 实现用例、业务规则、事务边界和领域 DTO；不得依赖 `net/http`、Gin 或具体前端响应结构。
- `backend/internal/infrastructure` 实现数据库、Redis、邮件、对象存储和 AI 等外部能力。SQL、GORM 查询和基础设施配置只在这里出现。
- `backend/internal/http/endpoint/<domain>` 只做 HTTP 适配：绑定请求、提取认证用户、调用 application service、映射错误和写响应。不得直接发起 SQL、管理事务或组装基础设施。
- `backend/internal/http/router` 是路径、HTTP 方法、路由分组的唯一所有者；每条路由上方使用中文注释说明业务功能。
- `backend/internal/http/request`、`response`、`middleware`、`endpoint/common` 放跨 endpoint 的 HTTP 通用能力，不放领域业务。
- `backend/internal/shared` 仅放无业务归属、可被多层复用的纯能力，例如常量、ID 和错误类型；不要把业务模型或数据库访问放入这里。

## 文件与命名

- 目录按领域拆分，不按技术名堆放。一个文件只围绕一个明确职责或用例组。
- 当文件超过约 300 行且包含多个独立用例时，优先按用例或子领域拆分；超过 500 行必须说明为何不能拆分。不要为了行数机械拆开同一事务流程。
- 请求和响应结构体放在所属领域的 `dto.go` 或紧邻 handler 的专用 DTO 文件；名称表达业务，例如 `CreateProjectInput`、`ProjectView`，避免 `Data`、`Result`、`Payload` 等泛化名称。
- 不用 `map[string]any` 承载稳定的业务输入、输出或持久化模型；仅用于确实动态的 JSON 内容。
- 导出类型、函数和包必须有准确注释。路由与面向用户的错误文案使用中文；代码标识符、包名和数据库字段保持英文。

## HTTP 与接口

- 业务请求的详细约定及当前接入范围以 `doc/api-request-contract.md` 为准；前端与 MSW 共用 `frontend/src/shared/api/contracts.ts` 的通用协议类型与错误码。默认连接真实后端，模拟服务仅由显式开发开关启用。认证、图片及生成接口见 `doc/backend-external-contract.md`。
- API 仅使用 `GET` 和 `POST`。读取使用 `GET`，筛选参数放 query；会改变状态的操作使用 `POST`，参数放 JSON。文件上传可使用 `multipart/form-data`。
- 路径采用 `/api/commands/<领域>/<动作>`，不使用通配路径、路径参数、`PATCH` 或 `DELETE`。路由不自行校验 HTTP Method，Gin 路由定义是唯一方法约束。
- 所有 JSON 返回使用统一顶层结构：`{"code": 0, "msg": "", "data": ...}`；错误由顶层错误边界转换，不在每个 handler 重复写 HTTP 错误响应。
- endpoint 使用 `endpoint/common` 解析 JSON 和写响应；不要重复实现 `decodeJSON`、鉴权解析或响应包装。

## 数据、错误与配置

- 数据库内部主键由 MySQL 自增；对外暴露资源使用稳定 UUID。不要把自增 ID 泄露到 API。
- 表间关联使用目标资源的 UUID，字段使用 `user_uuid`、`graph_uuid` 等明确名称；自增 `id` 仅用于表内主键及内部遍历。不建立数据库外键，也不通过 ORM 自动生成外键；关联存在性、归属、删除一致性由 application 用例及事务保证，关联查询所需索引显式定义。
- SQL/GORM 只在 persistence 仓储中。application 层依赖仓储接口或领域仓储，不依赖 `*gorm.DB`。
- 业务持久化使用 GORM；表结构通过独立命令执行有版本记录的 Go/GORM 迁移，不编写成套纯 SQL 建表文件，也不在 API 启动时 AutoMigrate。仅数据库创建、管理锁等 GORM 无法表达的特殊场景允许限定 SQL。演示作者必须带数据库测试账号标记，导入只由显式管理命令执行。
- 业务可预期错误使用 `internal/shared/fault` 或 application 领域错误表达，由 HTTP 顶层统一映射 `code` 和 `msg`；基础设施错误必须带上下文后上抛，不得静默吞掉。
- 超时、分页上限、文件大小、重试次数等可复用固定值放入 `internal/shared/constants`，不在业务函数中写魔法数字。
- 配置用中性能力名称，例如 `objectStorage`、`database`；不要将某个云厂商名称写进通用配置结构或业务逻辑。

## 前端

- 前端按 `app -> pages -> widgets -> features -> entities -> shared` 分层。只能从高层依赖低层；`shared` 不得依赖任何业务层，`entities` 不得依赖 `features`、`widgets` 或 `pages`。
- `app` 放路由、全局 Provider、应用级样式和启动配置；`pages` 只读取路由参数并编排 widget，不直接实现业务流程。
- `widgets` 是可复用的大块界面；`features` 是用户可触发的一项明确业务动作；`entities` 放项目、节点、合约、账户等稳定业务对象的类型、选择器和读取能力。
- 每个 feature 或 entity 按需使用 `api/`、`model/`、`ui/`、`lib/` 子目录。稳定业务类型放所属实体的 `model/types.ts`，不要再向根目录添加全局类型文件。
- 新增代码必须直接从所属的 `entities`、`features` 或 `shared` 导入。不要重新创建根目录 `types.ts` 或 `lib/` 作为跨领域杂物桶。
- 组件和渲染函数显式返回 JSX 时，统一使用 `return (`，JSX 从下一行开始并缩进，结束的 `)` 单独一行。短组件、提前返回和含 JSX 的条件返回也遵守此格式；已有括号不重复嵌套。`return null`、普通值及 effect 清理函数不受此规则影响。`return` 与左括号必须在同一行，避免自动分号插入导致返回空值。
- 固定格式的 UI 组件（头像、图标按钮、缩略图、节点图标等）必须通过组件内部明确的尺寸映射控制宽高；不要把 `size-fit`、`w-fit` 等自适应尺寸类与固定尺寸类同时使用，避免内容尺寸覆盖组件尺寸。
- 使用 Tailwind 时，全局 reset 和原生控件继承规则放入 `@layer base`；不要在 utility 层之后用普通选择器覆盖字号、行高或控件尺寸。
- 所有 HTTP 请求通过 `shared/api/client.ts`。页面、UI 组件和 store 不直接调用 `fetch`，也不直接拼接 API URL；领域 API 放在对应 feature/entity 的 `api/` 内。
- Zustand 只保存会话和必要的跨页面客户端状态。工作区、项目、节点等服务端事实必须由 API 刷新；组件的弹窗、筛选和表单草稿优先使用局部状态。不得加入运行时假数据、离线写入或持久化明文密码。
- 保持前端类型与后端公开 DTO 的字段语义一致。修改 API 时同步检查调用点；稳定的 API 输入和输出必须定义 TypeScript 类型，避免 `any` 和无语义的对象字面量。
- 远端业务数据由 TanStack Query 管理，不再复制到 Zustand；读取请求透传 AbortSignal，mutation 成功后按领域更新／失效缓存。Query 缓存、本地草稿和阅读状态保持各自职责。
- MSW 仅在显式启用的开发环境启动，handler 位于 `app/mocks`，沿用真实业务契约；AI 生成也采用业务 JSON 外壳，不用模拟数据回退真实接口失败。平台密钥仅存在服务端配置或环境变量。

### 静态原型与类型归属

- 固定演示数据集中在 `frontend/src/app/demo`，只供显式模拟和管理命令导出导入。下层组件不得自行导入演示数据，也不得用虚构记录补齐空状态；真实后端中的演示作者带测试账号标记，请求失败不能回退这些数据。
- 浏览器本地草稿与真实已发布事实分开管理。显式 MSW 环境的会话内演示操作不表示服务端持久化，不要将其扩展为通用离线业务数据库。
- 用户、图、行动等业务类型从所属实体的 `model/types.ts` 导入；图片、通用对话消息等不带业务归属的类型可放在 `shared/model` 的专用文件。`shared` UI 用最小展示结构接收数据，不依赖完整业务对象。
- 旧计划／完成模型集中在 `entities/action/model/legacy-types.ts`，只服务现有兼容读取；新功能使用行动节点模型。整理目录时保持已有 hash 路由、查询参数、节点 ID 和本地存储键兼容。
- ESLint 检查跨层导入约束；不能为了复用方便让低层反向依赖高层。跨界面的稳定纯逻辑应下沉到合适的 entity 或 shared，避免经由无关 feature、widget 转发。

### 状态、列表与本地草稿

- 区分业务事实、临时编辑草稿和阅读状态。需要返回保留的 Tab，分别保留筛选输入、已提交条件、结果分页／加载数量、选中项与滚动位置；不要通过切换 `key` 或卸载面板意外重置。
- 保持挂载的隐藏面板必须接收激活状态。无限滚动、画布布局和滚动定位只在激活时运行，离开时清理 observer、事件监听和动画帧，并忽略已排队的失效回调。
- 普通内容列表使用既有无限滚动，搜索使用显式提交和分页；公共加载逻辑复用 `shared/lib/useInfiniteList.ts`。不要在整理时统一成另一种交互，或重置已加载的阅读位置。
- 持久化草稿复用 `shared/lib/local-draft`；草稿键隔离账号、图、操作和目标节点。恢复前校验版本与结构，恢复完成前不得覆盖旧草稿；保存失败要反馈，发布成功或用户明确丢弃后才清除草稿。
- 领域选择器集中处理表达／约定的继承：`undefined` 表示继承，空字符串表示主动清空，不能用 `||` 合并两者。节点编号和层级分开计算；已知行动背景仅含当前引用链路，不能混入图内无关行动。

### 界面与回归

- 前端源码不手写无障碍专用属性，包括 `aria-*`、`role` 和 SVG `focusable`，也不新增 `ariaLabel` 等专门透传这些属性的组件参数。状态样式使用 `data-*`，图标按钮提示使用 `title` 或既有 Tooltip；测试优先验证可见内容和交互状态，不依赖无障碍属性定位。
- 保留原生 HTML 语义、表单 `label`、图片 `alt` 以及正常键盘操作所需的 `tabIndex` 和焦点管理。第三方组件内部自动生成的无障碍属性无需额外剥离，不修改依赖源码或加入运行时 DOM 清理逻辑。
- 复用现有头像、图标按钮、Tab、Select、Markdown 和图片预览组件；主题使用语义颜色。重构不同时调整字号、间距、文案和布局，避免把视觉改版混入结构整理。
- 列表条目的正文、用户资料、图片和时间／编号是不同的交互区域。复用或重构时保留各自行为，避免嵌套按钮、点击冒泡导致误跳转；键盘焦点及关闭预览后的焦点返回也要保留。
- 测试优先验证可观察行为和领域边界：继承／清空、直接引用与合入、搜索范围与跳转目标、Tab 返回状态、草稿恢复及失败。不要只检查源代码文本或用重复实现逻辑的测试代替验证；静态渲染测试不能证明浏览器滚动、拖拽和异步 effect 正确。

## 验证

- 后端改动至少运行：`gofmt -w <改动文件>`、`go test ./...` 和 `go vet ./...`；涉及事务、权限和并发时，显式启用 `EXEC_GRAPH_INTEGRATION=1` 连接隔离的真实 MySQL／Redis 验证。
- 前端改动至少运行：`cd frontend && bun run lint && bun run build`。
- 前端结构整理及共享状态逻辑改动同时运行 `cd frontend && bun run test`；涉及可见交互变化时再补浏览器验证。`test:graph` 只覆盖部分图相关行为，不能代替全量测试。
- 提交前运行 `git diff --check`。涉及接口、权限、事务或状态流时补充针对该行为的测试。
