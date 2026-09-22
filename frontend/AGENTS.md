# Exec Graph 前端开发规范

本文件是 `frontend` 目录下的前端专属开发约定。修改前端代码前，先阅读根目录 `AGENTS.md`、相关领域的现有实现和对应的产品文档；本文件补充前端细节，不覆盖根目录中的通用规则。

## 分层与依赖

前端按以下层次组织：

```text
app -> pages -> widgets -> features -> entities -> shared
```

依赖只能从左向右或从高层指向低层，不能反向依赖：

- `app` 放路由、全局 Provider、启动配置和应用级样式。不得放具体业务流程。
- `pages` 读取路由参数并编排页面结构，负责把页面交给 widgets；不得直接实现复杂业务操作。
- `widgets` 表示可复用的大块界面，例如项目工作区、个人页和工作总览；可以组合 features、entities 和 shared。
- `features` 表示用户可触发的一项明确业务动作，例如登录、头像上传、节点审查、项目创建和 AI 对话。
- `entities` 放稳定业务对象的类型、读取能力、选择器和基础 UI，例如账户、项目、节点、合约。
- `shared` 只放与业务无关的通用能力，例如 API client、对话框、通知、主题和通用展示组件。

禁止出现以下依赖：

- `shared` 依赖 `entities`、`features`、`widgets` 或 `pages`
- `entities` 依赖 `features`、`widgets` 或 `pages`
- `pages`、`widgets` 直接访问后端实现细节
- 在根目录重新创建全局 `types.ts`、`lib/` 或不明确职责的工具文件夹

## 目录职责

feature 或 entity 按实际需要使用以下子目录：

```text
<domain>/
├── api/       API 请求和领域 DTO
├── model/     稳定类型、选择器、状态和纯业务计算
├── ui/        领域组件
└── lib/       仅限该领域内部复用的纯工具
```

文件按明确职责拆分，不按“所有组件”“所有工具”建立杂物桶。一个组件文件围绕一个主要界面或一个清晰的 UI 职责；一个 API 文件围绕一个领域或一组紧密相关的用例。

组件或 hook 超过约 300 行且包含多个独立职责时，优先按界面区域、用例或子领域拆分；超过 500 行必须说明为什么不能拆分。不要为了凑行数拆开同一个不可分割的交互流程。

稳定业务类型放在所属 entity 的 `model/types.ts` 或领域 DTO 文件中。类型名称必须表达业务含义，例如 `ProjectSummary`、`CreateProjectInput`、`DailyActivityReview`；避免使用 `Data`、`Result`、`Payload`、`Item` 这类没有语义的名称。

## API 与数据流

- 所有 HTTP 请求必须通过 `src/shared/api/client.ts`。
- 页面、widget、feature UI 和 Zustand store 不得直接调用 `fetch`。
- 领域 API client 放在对应 feature 或 entity 的 `api/` 目录中，不在页面里拼接 API URL。
- 读取使用 `GET`，状态变更使用 `POST`；筛选参数使用 query，变更参数使用 JSON。
- 文件上传使用 `multipart/form-data`，不要手动设置 `Content-Type`，让浏览器生成 boundary。
- API client 必须处理统一响应结构 `{ code, msg, data }`，调用方只消费解包后的 `data`。
- 修改后端 DTO 或路由时，必须同步检查对应的 TypeScript 类型、API client 和所有调用点。
- 稳定的请求输入和响应输出必须定义类型，不使用 `any` 或无语义的对象字面量承载业务数据。
- 后端返回的服务端事实不能由前端运行时假造、补写或长期覆盖。

错误处理要保留后端返回的 `msg`，在用户可见的位置说明失败原因和下一步。不要把所有 API 错误统一改写成没有信息量的“操作失败”。加载、空数据、提交中、成功和失败状态都要有明确 UI。

## 状态管理

- Zustand 只保存登录会话和确实需要跨页面共享的客户端状态。
- 项目、节点、工作总览、审查记录和个人资料等服务端事实必须通过 API 读取和刷新。
- 弹窗开关、筛选条件、表单草稿、当前 tab 和临时错误优先使用组件局部状态。
- 不在 localStorage 或 Zustand 中持久化明文密码、AI 密钥或其他敏感原始凭据。
- 不加入离线写入、运行时 demo 数据或用默认对象掩盖接口失败。
- 乐观更新必须有明确的回滚或重新加载策略；不能让本地状态永久偏离服务端事实。

## React、表单与组件

- Hooks 只能在组件或自定义 hook 顶层调用，并保持稳定的依赖数组。
- 复杂表单优先使用项目已有的 `react-hook-form` 和 `zod` 模式；校验规则不要只写在按钮点击逻辑中。
- 一个组件同时承担请求、表单校验、复杂状态机和大段布局时，应优先拆出 API、model hook 和子组件。
- 组件通过明确 props 通信；不要用全局 store 传递只在一个页面使用的临时 UI 状态。
- 异步操作必须防止重复提交，并在卸载或请求过期时避免用旧结果覆盖新状态。
- 交互控件应使用语义化 HTML、可访问名称、键盘焦点和禁用状态。
- 图标优先使用项目已有的 `lucide-react`，不要为已有图标手写重复 SVG。

## 样式与视觉

- 主题令牌以 `src/app/styles.css` 为准；业务组件使用 Tailwind 语义令牌，例如 `bg-paper`、`bg-surface`、`text-ink`、`border-rail` 和 `bg-signal`。
- 不在业务组件中散落基础颜色值；需要主题适配的关系图或其他非 Tailwind 内容，通过 `src/shared/lib/theme.ts` 读取主题令牌。
- 保持现有的低压力、事实导向界面风格。状态颜色必须表达明确语义，不用渐变、装饰性图形或颜色堆叠替代信息层级。
- 页面优先保证信息层级、状态、边界和操作顺序清楚，再添加装饰。
- 新增响应式界面时检查窄屏、宽屏、长文本、加载状态和错误状态，确保文字不会溢出或覆盖其他内容。

## 认证与安全

- 需要登录的请求从统一会话状态读取 access token，并由共享 API client 设置 `Authorization`。
- 不在组件日志、错误提示、URL、localStorage 或提交内容中暴露 access token、密码或 AI 密钥。
- 公开页面和登录页面不得因为缺少认证状态而发起需要登录的请求。
- 退出登录后清理会话相关客户端状态，并让受保护页面回到登录流程。

## 修改与验证

修改前先搜索相关 API、类型和调用点，确认字段语义与现有行为。不要顺手重命名无关模块或覆盖用户已有工作区改动。

前端改动至少运行：

```bash
cd frontend
bun run lint
bun run build
```

涉及 API、鉴权、表单、状态流或响应式布局时，还应手动验证成功、失败、加载、空状态和窄屏表现。提交前运行：

```bash
git diff --check
```
