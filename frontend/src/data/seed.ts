import type { Actor, CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge, Project, SmartContractDefinition } from '../types'

export const currentActorId = 'actor-you'
export const defaultProjectId = 'project-default'

export const actors: Actor[] = [
  {
    id: currentActorId,
    name: '你',
    handle: '@you',
    role: '最终确认者',
    bio: '把行动变成可验证的完成记录。',
    gender: 'undisclosed',
    customProfileEnabled: true,
    customProfileMarkdown: `<style>
.profile-board {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
}

.profile-board h1 {
  margin: 0;
  color: #1d2939;
}

.profile-board p {
  margin: 0;
  color: #667085;
}

.pulse {
  display: inline-flex;
  width: 10px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #1677ff;
  box-shadow: 0 0 0 0 rgba(22, 119, 255, 0.42);
  animation: pulse 1.8s ease-out infinite;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #e4e7ec;
}

.profile-grid div {
  padding: 14px;
  border-right: 1px solid #e4e7ec;
}

.profile-grid div:last-child {
  border-right: 0;
}

.profile-grid strong {
  display: block;
  color: #1d2939;
  font-size: 26px;
}

.profile-grid span {
  color: #667085;
  font: 700 11px/1 "JetBrains Mono", ui-monospace, monospace;
}

@keyframes pulse {
  to {
    box-shadow: 0 0 0 14px rgba(22, 119, 255, 0);
  }
}

@media (max-width: 700px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .profile-grid div {
    border-right: 0;
    border-bottom: 1px solid #e4e7ec;
  }

  .profile-grid div:last-child {
    border-bottom: 0;
  }
}
</style>

<section class="profile-board">
  <h1><span class="pulse"></span> 正在建立可验证的执行系统</h1>
  <p>我用 ExecG 记录真实推进，而不是只写待办。公开项目里只展示已经愿意接受旁观的行动路径。</p>
  <div class="profile-grid">
    <div><strong>1</strong><span>PUBLIC PROJECT</span></div>
    <div><strong>2</strong><span>LOCKED RECORDS</span></div>
    <div><strong>AI</strong><span>REVIEW + CONFIRM</span></div>
  </div>
  <p>节点记录行动，完成记录由智能合约审查后生成。</p>
</section>
`,
  },
  {
    id: 'actor-lin',
    name: '林舟',
    handle: '@lin',
    role: '契约制定者',
  },
  {
    id: 'actor-qiao',
    name: '乔野',
    handle: '@qiao',
    role: '旁观审查者',
  },
]

export const smartContracts: SmartContractDefinition[] = [
  {
    id: 'skill-general-contract',
    name: '通用执行智能合约',
    source: 'official',
    version: '1.0.0',
    description: '定义可部署目标的最低规则，并验证结果是否满足已冻结要求。',
    body: `## 部署规则

- 必须写明可验证目标
- 必须至少列出两条验收标准
- 必须说明每条标准所需的证据

## AI 审查原则

只判断用户提交的完成说明和证据是否满足冻结的验收标准，不临时提高标准。`,
  },
  {
    id: 'smart-contract-quick-action',
    name: '快速行动规则',
    source: 'official',
    version: '1.0.0',
    description: '适合洗澡、刷牙、铺床等一次性小事，用少量可观察检查项确认当下是否做到。',
    body: `## 适用范围

适合洗澡、刷牙、铺床等一次性的小行动。

## 部署规则

- 只定义一个当下可以完成的具体动作
- 用 2 到 5 个可观察的检查项说明做到什么算完成
- 允许完成、部分完成和未完成，不要求照片或复杂材料

## AI 审查原则

检查用户是否说明了各项实际完成情况。只指出缺少的事实，不把部分完成写成全部完成，也不因一次未完成评价用户的人格。`,
  },
  {
    id: 'smart-contract-daily-routine',
    name: '日常习惯规则',
    source: 'official',
    version: '1.0.0',
    description: '适合每天或每周重复的行动，记录每次实例、连续性与真实阻碍。',
    body: `## 适用范围

适合每天或每周重复的生活行动，例如每天洗澡、刷牙或整理床铺。

## 部署规则

- 明确行动频率和本次要完成的具体实例
- 每次记录实际完成情况，可标记完成、部分完成、未完成或受阻
- 记录足以说明当次完成状态的简短事实，不要求复杂证据

## AI 审查原则

关注频率、连续性和实际阻碍，帮助用户决定下一次最小行动。周期性总结执行状态，但不把中断归因于人格，也不替用户补写未发生的事实。`,
  },
  {
    id: 'skill-product-design',
    name: '产品设计智能合约',
    source: 'official',
    version: '1.0.0',
    description: '用于产品逻辑、信息架构、页面心智和交互闭环的目标制定与完成审查。',
    body: `## 部署规则

- 目标必须对应明确用户痛点
- 验收标准必须产出可被实现引用的结构
- 证据必须能定位到具体设计或实现

## AI 审查原则

一个产品设计节点必须产出可被后续实现引用的结构，而不是抽象想法。`,
  },
  {
    id: 'skill-strict-self',
    name: '严格自证智能合约',
    source: 'custom',
    version: '0.3.0',
    description: '用户自定义的严格审查协议，对“我觉得完成了”保持怀疑，要求逐条证据。',
    body: `## 部署规则

- 目标不能使用主观完成表述
- 每条验收标准必须有一对一证据
- 缺口必须转成新的补充合约

## AI 审查原则

没有对应证据的完成声明一律视为证据不足。`,
  },
]

export const projects: Project[] = [
  {
    id: defaultProjectId,
    title: '我的执行',
    description: '用于开始和整理你的行动。',
    isDefault: false,
    visibility: 'private',
    projectType: 'guided',
    projectRules: '每次只推进一个明确行动；所有完成结果必须有可核验的证据。',
    currentContractId: 'contract-focus-supplement',
    activeContractRevisionId: 'project-default-r1',
    contractRevisions: [
      {
        id: 'project-default-r1',
        smartContractId: 'skill-general-contract',
        smartContractVersion: '1.0.0',
        reason: '平台默认智能合约',
        activatedAt: '2026-08-24T08:00:00.000Z',
      },
    ],
    createdAt: '2026-08-24T08:00:00.000Z',
  },
  {
    id: 'project-exec-graph',
    title: '执行契约网络 MVP',
    description: '用智能合约冻结目标规则，用 AI 验证和用户签名形成公开完成记录。',
    isDefault: false,
    visibility: 'public',
    projectType: 'guided',
    projectRules: '所有行动都要围绕执行图谱的可用性展开；公开记录必须能够被旁观者复核。',
    currentContractId: null,
    activeContractRevisionId: 'project-exec-graph-r1',
    contractRevisions: [
      {
        id: 'project-exec-graph-r1',
        smartContractId: 'skill-product-design',
        smartContractVersion: '1.0.0',
        reason: '项目创建时选择的产品设计智能合约',
        activatedAt: '2026-08-24T08:30:00.000Z',
      },
    ],
    createdAt: '2026-08-24T08:30:00.000Z',
  },
  {
    id: 'project-writing',
    title: '产品叙事整理',
    description: '把执行力传播、智能合约审查、公开记录和补充节点整理成一套清晰叙事。',
    isDefault: false,
    visibility: 'private',
    projectType: 'autonomous',
    projectRules: '',
    currentContractId: 'contract-case-notes',
    activeContractRevisionId: 'project-writing-r1',
    contractRevisions: [
      {
        id: 'project-writing-r1',
        smartContractId: 'skill-general-contract',
        smartContractVersion: '1.0.0',
        reason: '项目创建时选择的通用执行智能合约',
        activatedAt: '2026-08-24T09:00:00.000Z',
      },
    ],
    createdAt: '2026-08-24T09:00:00.000Z',
  },
]

export const branches: ExecutionBranch[] = [
  {
    id: 'branch-public-model',
    projectId: 'project-exec-graph',
    title: '核心执行模型',
    rootContractId: 'contract-skill-contract',
    headContractId: 'contract-gap-supplement',
    currentContractId: 'contract-gap-supplement',
    createdById: currentActorId,
    createdAt: '2026-08-24T09:50:00.000Z',
  },
  {
    id: 'branch-public-lineage',
    projectId: 'project-exec-graph',
    title: '节点链表达',
    rootContractId: 'contract-goal-lineage',
    forkedFromContractId: 'contract-home-redesign',
    headContractId: 'contract-goal-lineage',
    currentContractId: 'contract-goal-lineage',
    createdById: 'actor-lin',
    createdAt: '2026-08-24T11:10:00.000Z',
  },
  {
    id: 'branch-public-workspace',
    projectId: 'project-exec-graph',
    title: '项目工作台',
    rootContractId: 'contract-project-workspace',
    forkedFromContractId: 'contract-skill-contract',
    headContractId: 'contract-contract-copy',
    currentContractId: 'contract-contract-copy',
    createdById: currentActorId,
    createdAt: '2026-08-26T08:40:00.000Z',
  },
]

export const contracts: ExecutionContract[] = [
  {
    id: 'contract-skill-contract',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-model',
    projectContractRevisionId: 'project-exec-graph-r1',
    actorId: currentActorId,
    title: '定义智能合约驱动的执行模型',
    stage: 'completed',
    originalIntent: '我想把产品从任务管理改成 AI 审查驱动。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '产出一版新的产品核心模型，明确智能合约、AI 审查、用户最终签名和补充合约之间的关系。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '说明智能合约在节点中承担规则冻结和完成审查两个阶段。',
        requiredEvidence: '模型描述中必须同时出现规则冻结和审查。',
      },
      {
        id: 'c2',
        text: '说明验收标准在契约冻结后不可被 AI 临时改写。',
        requiredEvidence: '必须写明合约 ID、版本和冻结验收标准。',
      },
      {
        id: 'c3',
        text: '说明未完成结论如何转化成补充节点。',
        requiredEvidence: '必须包含补充节点的生成逻辑。',
      },
    ],
    evidenceRequirement: '提交结构化产品逻辑说明，能指导前端重构。',
    completionClaim: '已经把节点重定义为执行契约，并明确智能合约既负责冻结规则，也负责按同一版本标准审查完成声明。未完成部分会生成补充合约继续闭合。',
    evidenceText:
      '核心链路：外部 Skill 生成可验证目标和验收标准 -> 用户粘贴并冻结 -> 用户提交完成结果 -> 网站 AI 一次审查 -> 用户最终签名 -> 生成下一合约或补充合约。',
    reviewMessages: [
      {
        id: 'm1',
        speaker: 'user',
        body: '我想把任务系统改成智能合约驱动的执行网络。',
        createdAt: '2026-08-24T10:00:00.000Z',
      },
      {
        id: 'm2',
        speaker: 'ai',
        body: '建议冻结合约 ID、合约版本、可验证目标和验收标准。审查只能基于这些冻结内容。',
        createdAt: '2026-08-24T10:02:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-skill-contract',
      verdict: 'pass',
      summary: '完成。该声明覆盖了智能合约双阶段、冻结标准和补充合约生成逻辑。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '明确写出智能合约负责冻结规则和审查。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '明确要求冻结合约 ID、版本和验收标准。',
        },
        {
          criterionId: 'c3',
          result: 'met',
          reason: '说明未完成部分会进入补充合约。',
        },
      ],
      createdAt: '2026-08-24T10:08:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这个节点已经形成后续实现可以引用的产品模型。',
      createdAt: '2026-08-24T10:12:00.000Z',
    },
    nextContractTitle: '把前端首页改成执行契约台',
    createdAt: '2026-08-24T09:50:00.000Z',
    updatedAt: '2026-08-24T10:12:00.000Z',
  },
  {
    id: 'contract-home-redesign',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-model',
    projectContractRevisionId: 'project-exec-graph-r1',
    parentContractId: 'contract-skill-contract',
    actorId: currentActorId,
    title: '把前端首页改成执行契约台',
    stage: 'needs_supplement',
    originalIntent: '首页不要再像任务管理，要体现 AI 审查和公开契约。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '重设首页信息架构，让第一屏展示待闭合契约、AI 审查结论、未闭合缺口和最近公开记录。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '首页第一屏不出现任务看板式状态列。',
        requiredEvidence: '截图或说明中应看不到看板列布局。',
      },
      {
        id: 'c2',
        text: '首页必须突出至少一个 AI 审查结论和用户最终确认动作。',
        requiredEvidence: '界面中有 AI 结论和确认入口。',
      },
      {
        id: 'c3',
        text: '首页必须展示未完成缺口可以变成补充节点。',
        requiredEvidence: '界面中出现补充节点入口或缺口提示。',
      },
    ],
    evidenceRequirement: '提交前端页面改动说明，展示契约闭合心智。',
    completionClaim: '已经把首页从任务仪表盘改成契约台，第一屏显示等待闭合的契约、AI 审查和用户确认动作，并在 AI 未通过时提供补充节点入口。',
    evidenceText: '首页结构改为：智能合约主卡、合约说明、AI 审查摘要、待签名记录、未闭合缺口。没有看板列。',
    reviewMessages: [
      {
        id: 'm3',
        speaker: 'user',
        body: '我完成了首页重构，它现在更像契约台。',
        createdAt: '2026-08-24T11:00:00.000Z',
      },
      {
        id: 'm4',
        speaker: 'ai',
        body: '我会按冻结的三个验收标准逐条检查，重点看是否仍保留任务看板结构。',
        createdAt: '2026-08-24T11:01:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-home-redesign',
      verdict: 'partial',
      summary: '部分完成。首页已经弱化看板，但补充节点入口还不够明确。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '没有出现任务看板式状态列。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '能看到 AI 审查摘要和用户确认入口。',
        },
        {
          criterionId: 'c3',
          result: 'unclear',
          reason: '未完成缺口存在，但补充节点入口不够显性。',
        },
      ],
      suggestedSupplementTitle: '强化未完成缺口的补充节点入口',
      createdAt: '2026-08-24T11:08:00.000Z',
    },
    nextContractTitle: '把目标场改成契约谱系',
    createdAt: '2026-08-24T10:20:00.000Z',
    updatedAt: '2026-08-24T11:08:00.000Z',
  },
  {
    id: 'contract-gap-supplement',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-model',
    projectContractRevisionId: 'project-exec-graph-r1',
    parentContractId: 'contract-home-redesign',
    supplementOfContractId: 'contract-home-redesign',
    title: '强化未完成缺口的补充节点入口',
    stage: 'frozen',
    originalIntent: 'AI 认为补充节点入口不够显性，我要补这一段。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '在首页和契约详情页显性展示“基于 AI 缺口生成补充节点”的入口和上下游关系。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '未通过或部分通过的 AI 审查卡片必须显示补充节点建议。',
        requiredEvidence: '界面能看到 AI suggestedSupplementTitle。',
      },
      {
        id: 'c2',
        text: '用户可以从 AI 审查结果生成补充契约。',
        requiredEvidence: '存在生成补充节点的按钮或已生成的补充节点记录。',
      },
    ],
    evidenceRequirement: '提交界面说明或截图，证明补充入口存在。',
    reviewMessages: [
      {
        id: 'm5',
        speaker: 'ai',
        body: '这是从未满足验收标准 c3 生成的补充契约，只补缺口，不重做整个首页。',
        createdAt: '2026-08-24T11:10:00.000Z',
      },
    ],
    createdAt: '2026-08-24T11:10:00.000Z',
    updatedAt: '2026-08-24T11:10:00.000Z',
  },
  {
    id: 'contract-goal-lineage',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-lineage',
    projectContractRevisionId: 'project-exec-graph-r1',
    parentContractId: 'contract-home-redesign',
    title: '把目标场改成契约谱系',
    stage: 'frozen',
    originalIntent: '目标场不要像项目页，要像执行契约的谱系。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '重新组织目标场页面，使它展示闭合主线、AI 争议节点、补充合约链和被使用的智能合约。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '目标场页面的主结构是契约谱系，而不是按状态分列。',
        requiredEvidence: '页面中应优先出现主线、缺口和补充关系。',
      },
      {
        id: 'c2',
        text: '能看到每个节点使用的智能合约和 AI 审查结论。',
        requiredEvidence: '契约卡片显示智能合约名称和 AI 结论。',
      },
      {
        id: 'c3',
        text: '能区分已闭合节点和需要补充的节点。',
        requiredEvidence: '视觉上标出已完成与需要补充的差异。',
      },
    ],
    evidenceRequirement: '提交目标场页面实现或说明。',
    reviewMessages: [],
    createdAt: '2026-08-24T11:15:00.000Z',
    updatedAt: '2026-08-24T11:15:00.000Z',
  },
  {
    id: 'contract-narrative',
    projectId: 'project-writing',
    projectContractRevisionId: 'project-writing-r1',
    actorId: 'actor-lin',
    title: '写出新的产品一句话定义',
    stage: 'completed',
    originalIntent: '我想让别人一眼理解这个产品不是任务管理。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '写出一句 50 字以内的产品定义，必须包含智能合约、可验证目标、AI 审查和用户签名。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '定义不使用“任务管理”作为核心表达。',
        requiredEvidence: '最终句子里不出现任务管理。',
      },
      {
        id: 'c2',
        text: '定义包含智能合约、AI 审查和用户签名。',
        requiredEvidence: '三个概念都出现在定义中。',
      },
    ],
    evidenceRequirement: '提交一句话定义。',
    completionClaim: '智能合约把模糊目标冻结为可验证规则，AI 公开审查，用户签名确认并接续补充。',
    evidenceText: '一句话定义已提交。',
    reviewMessages: [
      {
        id: 'm6',
        speaker: 'ai',
        body: '定义覆盖三个必需概念，且没有落回任务管理。',
        createdAt: '2026-08-24T12:00:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-narrative',
      verdict: 'pass',
      summary: '完成。定义短、清楚，并覆盖智能合约、AI 审查和用户签名。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '没有使用任务管理作为核心表达。',
        },
        { criterionId: 'c2', result: 'met', reason: '三个概念均已出现。' },
      ],
      createdAt: '2026-08-24T12:00:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '这句话可以作为新的产品定义。',
      createdAt: '2026-08-24T12:03:00.000Z',
    },
    createdAt: '2026-08-24T11:30:00.000Z',
    updatedAt: '2026-08-24T12:03:00.000Z',
  },
  {
    id: 'contract-daily-output',
    projectId: defaultProjectId,
    projectContractRevisionId: 'project-default-r1',
    actorId: currentActorId,
    title: '建立今天的可交付清单',
    stage: 'completed',
    originalIntent: '我不想只列待办，想让今天的行动能留下可验证的输出。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '在开始工作前列出三个当天可以提交、链接或展示的具体输出，并为每项标明验证位置。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '清单包含三个具体输出，而不是活动描述。',
        requiredEvidence: '清单中每项均为可提交或可展示的结果。',
      },
      {
        id: 'c2',
        text: '每项输出都标明了可验证的位置。',
        requiredEvidence: '每项附带链接、文件位置或展示方式。',
      },
    ],
    evidenceRequirement: '提交当天输出清单和每项的验证位置。',
    completionClaim: '今天的输出已经收敛为产品逻辑笔记、首页交互稿和一次审查记录三个可交付结果。',
    evidenceText: 'C1：清单包含三个可交付结果。C2：每项均写明对应文档、原型和审查页面的位置。',
    reviewMessages: [
      {
        id: 'm7',
        speaker: 'user',
        body: '我把今天要做的内容改成了三个可提交的输出。',
        createdAt: '2026-08-25T08:30:00.000Z',
      },
      {
        id: 'm8',
        speaker: 'ai',
        body: '三个输出均可验证，且各自给出了定位方式。',
        createdAt: '2026-08-25T08:34:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-daily-output',
      verdict: 'pass',
      summary: '完成。清单以可交付结果组织，并提供了逐项验证位置。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '三项均为明确的产出，而非笼统活动。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '每项都附有可定位的验证位置。',
        },
      ],
      createdAt: '2026-08-25T08:34:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认今天的行动已经转化为可以核验的输出清单。',
      createdAt: '2026-08-25T08:36:00.000Z',
    },
    nextContractTitle: '整理阅读资料的可引用结论',
    createdAt: '2026-08-25T08:10:00.000Z',
    updatedAt: '2026-08-25T08:36:00.000Z',
  },
  {
    id: 'contract-reading-notes',
    projectId: defaultProjectId,
    projectContractRevisionId: 'project-default-r1',
    parentContractId: 'contract-daily-output',
    actorId: currentActorId,
    title: '整理三篇资料的可引用结论',
    stage: 'completed',
    originalIntent: '我读了很多资料，但常常没有可以直接用于判断或写作的结论。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '从三篇资料中各提炼一条可引用结论，并标明原文位置和将被使用的决策。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '三篇资料各有一条完整、可复述的结论。',
        requiredEvidence: '提供三条结论及资料标题。',
      },
      {
        id: 'c2',
        text: '每条结论同时标明来源位置和使用场景。',
        requiredEvidence: '每条附原文位置与对应决策。',
      },
    ],
    evidenceRequirement: '提交三条结论、来源位置和后续使用场景。',
    completionClaim: '三篇资料已各自提炼一条结论，分别用于确定产品约束、审查方式和公开记录的展示。',
    evidenceText: 'C1：资料 A、B、C 各有一条可复述结论。C2：每条都记录了段落位置和对应的产品决策。',
    reviewMessages: [
      {
        id: 'm9',
        speaker: 'user',
        body: '我已把三篇资料压缩成可以直接引用的结论。',
        createdAt: '2026-08-25T09:30:00.000Z',
      },
      {
        id: 'm10',
        speaker: 'ai',
        body: '结论、来源位置和使用场景完整对应，可以进入签名。',
        createdAt: '2026-08-25T09:35:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-reading-notes',
      verdict: 'pass',
      summary: '通过。三条结论均能定位到来源，并说明了将影响的后续决策。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '三篇资料均形成了完整结论。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '来源位置和使用场景都已给出。',
        },
      ],
      createdAt: '2026-08-25T09:35:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这次整理已经把前面的阅读推进收束为可引用结论。',
      createdAt: '2026-08-25T09:38:00.000Z',
    },
    createdAt: '2026-08-25T08:45:00.000Z',
    updatedAt: '2026-08-25T09:35:00.000Z',
  },
  {
    id: 'contract-workspace-reset',
    projectId: defaultProjectId,
    projectContractRevisionId: 'project-default-r1',
    title: '清理工作台，只保留本周材料',
    stage: 'frozen',
    originalIntent: '我需要一个不会不断拉走注意力的工作空间。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '清理工作台，使打开时只出现本周正在使用的文件、入口和一个明确的下一步。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '工作台首屏只保留本周必需材料。',
        requiredEvidence: '提交整理后的首屏截图或文件列表。',
      },
      {
        id: 'c2',
        text: '首屏有一个明确、可执行的下一步。',
        requiredEvidence: '截图或说明标出下一步入口。',
      },
    ],
    evidenceRequirement: '提交整理后的工作台截图，并说明保留材料的理由。',
    reviewMessages: [
      {
        id: 'm11',
        speaker: 'ai',
        body: '规则已冻结。整理完成后请提交首屏证据，不能只描述“感觉更清爽”。',
        createdAt: '2026-08-25T10:00:00.000Z',
      },
    ],
    createdAt: '2026-08-25T09:50:00.000Z',
    updatedAt: '2026-08-25T10:00:00.000Z',
  },
  {
    id: 'contract-weekly-review',
    projectId: defaultProjectId,
    projectContractRevisionId: 'project-default-r1',
    actorId: currentActorId,
    title: '完成本周复盘并产出下一步',
    stage: 'needs_supplement',
    originalIntent: '我不想做只有感受、没有后续行动的周复盘。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '复盘本周三个已完成输出和一个阻塞点，并从阻塞点生成一条可验证的下周节点。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '复盘明确列出三个已完成输出。',
        requiredEvidence: '记录中可定位到三个已完成结果。',
      },
      {
        id: 'c2',
        text: '阻塞点被转化为一条可验证的下周节点。',
        requiredEvidence: '提供节点标题、目标和验收标准。',
      },
    ],
    evidenceRequirement: '提交复盘记录和从阻塞点导出的下一条节点。',
    completionClaim: '复盘已经列出三个输出，也说明了本周的阻塞点是上午注意力被消息打断。',
    evidenceText: 'C1：记录了产品模型、阅读结论和工作台清理三个结果。C2：只写了要减少消息干扰，尚未形成可验证节点。',
    reviewMessages: [
      {
        id: 'm12',
        speaker: 'user',
        body: '我完成了本周复盘，并识别出消息干扰这个阻塞点。',
        createdAt: '2026-08-25T18:00:00.000Z',
      },
      {
        id: 'm13',
        speaker: 'ai',
        body: '已完成输出可核验，但阻塞点还没有被转成一条可部署节点。',
        createdAt: '2026-08-25T18:04:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-weekly-review',
      verdict: 'partial',
      summary: '未通过。复盘已经记录结果，但阻塞点没有形成可验证的下一步节点。',
      criterionReviews: [
        { criterionId: 'c1', result: 'met', reason: '三个输出均有记录。' },
        {
          criterionId: 'c2',
          result: 'unclear',
          reason: '只有行动意图，没有目标和验收标准。',
        },
      ],
      suggestedSupplementTitle: '把消息干扰转成可验证的注意力保护节点',
      createdAt: '2026-08-25T18:04:00.000Z',
    },
    createdAt: '2026-08-25T17:30:00.000Z',
    updatedAt: '2026-08-25T18:04:00.000Z',
  },
  {
    id: 'contract-focus-supplement',
    projectId: defaultProjectId,
    projectContractRevisionId: 'project-default-r1',
    parentContractId: 'contract-weekly-review',
    supplementOfContractId: 'contract-weekly-review',
    title: '把消息干扰转成可验证的注意力保护节点',
    stage: 'frozen',
    originalIntent: 'AI 认为周复盘没有把阻塞点转成可验证节点，我只补这个缺口。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '制定并执行一次不被消息打断的高强度专注安排，留下设置和产出证据。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '专注安排包含明确的屏蔽规则和开始条件。',
        requiredEvidence: '提交设置说明或截图。',
      },
      {
        id: 'c2',
        text: '安排结束后有一个与专注主题对应的产出。',
        requiredEvidence: '提交产出链接或结果摘要。',
      },
    ],
    evidenceRequirement: '提交屏蔽设置和一次专注后的可验证产出。',
    reviewMessages: [
      {
        id: 'm14',
        speaker: 'ai',
        body: '这是从周复盘缺口生成的补充节点，只验证注意力保护和产出。',
        createdAt: '2026-08-25T18:10:00.000Z',
      },
    ],
    createdAt: '2026-08-25T18:10:00.000Z',
    updatedAt: '2026-08-25T18:10:00.000Z',
  },
  {
    id: 'contract-project-workspace',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-workspace',
    projectContractRevisionId: 'project-exec-graph-r1',
    parentContractId: 'contract-skill-contract',
    actorId: currentActorId,
    title: '把项目页收敛为节点闭合工作台',
    stage: 'completed',
    originalIntent: '项目页不该展示所有系统信息，只该让我看到下一条需要闭合的节点。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '项目页第一屏按签名、提交证明和缺口接续展示可处理节点，并将合约治理降为次级操作。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '项目页第一屏按可处理动作组织节点。',
        requiredEvidence: '页面中能看到签名、证明和接续三个动作分组。',
      },
      {
        id: 'c2',
        text: '合约治理不与日常节点动作竞争。',
        requiredEvidence: '升级合约入口在次级区域展示。',
      },
    ],
    evidenceRequirement: '提交项目页截图和动作分组说明。',
    completionClaim: '项目页已改为先展示需要闭合的节点，再提供冻结节点入口，合约修改收进次级治理区。',
    evidenceText: 'C1：页面按等待签名、等待提交证明和 AI 锁定的缺口分组。C2：修改项目智能合约收进折叠区域。',
    reviewMessages: [
      {
        id: 'm15',
        speaker: 'user',
        body: '我收敛了项目页，只保留当前可闭合节点与次级治理。',
        createdAt: '2026-08-26T09:20:00.000Z',
      },
      {
        id: 'm16',
        speaker: 'ai',
        body: '动作分组和治理降级均符合冻结的验收标准。',
        createdAt: '2026-08-26T09:24:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-project-workspace',
      verdict: 'pass',
      summary: '完成。项目页以节点闭合为中心，合约治理不再抢占主流程。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '可处理节点按动作分组展示。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '合约升级收进了次级区域。',
        },
      ],
      createdAt: '2026-08-26T09:24:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认项目页已经能够直接引导下一次闭合。',
      createdAt: '2026-08-26T09:26:00.000Z',
    },
    createdAt: '2026-08-26T08:40:00.000Z',
    updatedAt: '2026-08-26T09:26:00.000Z',
  },
  {
    id: 'contract-contract-copy',
    projectId: 'project-exec-graph',
    branchId: 'branch-public-workspace',
    parentContractId: 'contract-project-workspace',
    projectContractRevisionId: 'project-exec-graph-r1',
    actorId: currentActorId,
    title: '收敛智能合约相关命名',
    stage: 'verified',
    originalIntent: '页面上的项目、节点和智能合约概念不能互相混用。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    verifiableGoal: '统一项目、执行节点和项目智能合约的界面命名，使用户能区分规则与被规则审查的对象。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '项目智能合约只表示项目层的审查规则。',
        requiredEvidence: '项目页和节点页不把节点本身称为项目智能合约。',
      },
      {
        id: 'c2',
        text: '执行对象统一称为节点。',
        requiredEvidence: '主要动作和卡片标题使用节点而非任务或合约记录。',
      },
    ],
    evidenceRequirement: '提交命名调整后的页面截图和术语对照。',
    completionClaim: '界面已经把项目智能合约限定为规则，把用户创建和闭合的对象统一称作执行节点。',
    evidenceText: 'C1：项目页顶栏和节点页规则卡明确写项目智能合约。C2：创建、图谱和动作卡均使用执行节点。',
    reviewMessages: [
      {
        id: 'm17',
        speaker: 'user',
        body: '我完成了项目、节点和智能合约三个概念的界面收敛。',
        createdAt: '2026-08-26T10:10:00.000Z',
      },
      {
        id: 'm18',
        speaker: 'ai',
        body: '术语边界清楚，两个冻结标准均有对应证据。',
        createdAt: '2026-08-26T10:14:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-contract-copy',
      verdict: 'pass',
      summary: '通过。规则与执行节点的命名边界清晰，可以等待本人签名。',
      criterionReviews: [
        {
          criterionId: 'c1',
          result: 'met',
          reason: '项目智能合约只用于描述审查规则。',
        },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '执行对象在主要页面中统一称为节点。',
        },
      ],
      createdAt: '2026-08-26T10:14:00.000Z',
    },
    createdAt: '2026-08-26T09:40:00.000Z',
    updatedAt: '2026-08-26T10:14:00.000Z',
  },
  {
    id: 'contract-case-notes',
    projectId: 'project-writing',
    projectContractRevisionId: 'project-writing-r1',
    parentContractId: 'contract-narrative',
    title: '整理三个公开案例的证据段落',
    stage: 'frozen',
    originalIntent: '对外表达不能只有观点，需要让人看到可验证的产品行为。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '整理三个能够说明产品审查机制的公开案例，每个案例附结果、证据和一句解释。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '整理出三个彼此不同的公开案例。',
        requiredEvidence: '提交三个案例标题与对应页面。',
      },
      {
        id: 'c2',
        text: '每个案例均包含结果、证据和解释。',
        requiredEvidence: '每个案例使用同一结构呈现三项信息。',
      },
    ],
    evidenceRequirement: '提交案例列表及每项的结果、证据和解释。',
    reviewMessages: [
      {
        id: 'm19',
        speaker: 'ai',
        body: '案例节点已冻结，后续需要用公开页面或材料逐条支撑。',
        createdAt: '2026-08-26T11:00:00.000Z',
      },
    ],
    createdAt: '2026-08-26T10:50:00.000Z',
    updatedAt: '2026-08-26T11:00:00.000Z',
  },
  {
    id: 'contract-story-structure',
    projectId: 'project-writing',
    projectContractRevisionId: 'project-writing-r1',
    parentContractId: 'contract-narrative',
    actorId: currentActorId,
    title: '写出产品介绍的三段结构',
    stage: 'completed',
    originalIntent: '介绍产品时需要先让人理解它解决什么，再看到规则和结果。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    verifiableGoal: '写出问题、智能合约规则、公开完成记录三段式介绍，并使每段对应一个具体事实。',
    acceptanceCriteria: [
      {
        id: 'c1',
        text: '介绍包含问题、规则和结果三个明确段落。',
        requiredEvidence: '提交三段标题和正文。',
      },
      {
        id: 'c2',
        text: '每段都能定位到一个具体事实或案例。',
        requiredEvidence: '每段附一个事实或案例链接。',
      },
    ],
    evidenceRequirement: '提交三段式介绍和每段的事实依据。',
    completionClaim: '介绍已按用户痛点、项目智能合约如何冻结规则、签名完成如何成为公开记录三段展开。',
    evidenceText: 'C1：文稿包含问题、规则、结果三个标题段。C2：每段均引用一个节点、审查结论或完成记录。',
    reviewMessages: [
      {
        id: 'm20',
        speaker: 'user',
        body: '我完成了三段式产品介绍，并给每段补了事实依据。',
        createdAt: '2026-08-26T12:10:00.000Z',
      },
      {
        id: 'm21',
        speaker: 'ai',
        body: '三段结构完整，每段均有可定位的事实支撑。',
        createdAt: '2026-08-26T12:14:00.000Z',
      },
    ],
    aiReview: {
      id: 'review-story-structure',
      verdict: 'pass',
      summary: '完成。介绍按问题、规则和结果展开，且没有停留在抽象口号。',
      criterionReviews: [
        { criterionId: 'c1', result: 'met', reason: '三个段落结构清晰。' },
        {
          criterionId: 'c2',
          result: 'met',
          reason: '每段均提供了可定位事实。',
        },
      ],
      createdAt: '2026-08-26T12:14:00.000Z',
    },
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这份介绍已经能用具体事实解释产品。',
      createdAt: '2026-08-26T12:16:00.000Z',
    },
    createdAt: '2026-08-26T11:30:00.000Z',
    updatedAt: '2026-08-26T12:16:00.000Z',
  },
]

export const completionRecords: CompletionRecord[] = [
  {
    id: 'record-default-reading-stage',
    projectId: defaultProjectId,
    closingContractId: 'contract-reading-notes',
    coveredContractIds: ['contract-daily-output', 'contract-reading-notes'],
    title: '整理三篇资料的可引用结论',
    summary: '这次推进让今天的输出清单和资料整理一起形成了可引用的阶段成果。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    reviewId: 'review-reading-notes',
    aiReviewVerdict: 'pass',
    recordKind: 'accepted',
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这次整理已经把前面的阅读推进收束为可引用结论。',
      createdAt: '2026-08-25T09:38:00.000Z',
    },
    createdAt: '2026-08-25T09:38:00.000Z',
  },
  {
    id: 'record-product-model',
    projectId: 'project-exec-graph',
    closingContractId: 'contract-skill-contract',
    coveredContractIds: ['contract-skill-contract'],
    title: '定义智能合约驱动的执行模型',
    summary: '智能合约、冻结规则、AI 审查和补充推进的关系已经形成可引用模型。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    reviewId: 'review-skill-contract',
    aiReviewVerdict: 'pass',
    recordKind: 'accepted',
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这个节点已经形成后续实现可以引用的产品模型。',
      createdAt: '2026-08-24T10:12:00.000Z',
    },
    createdAt: '2026-08-24T10:12:00.000Z',
  },
  {
    id: 'record-project-workspace',
    projectId: 'project-exec-graph',
    closingContractId: 'contract-project-workspace',
    coveredContractIds: ['contract-project-workspace'],
    title: '把项目页收敛为节点闭合工作台',
    summary: '项目页已经围绕可处理节点组织，合约治理退到次级区域。',
    smartContractId: 'skill-product-design',
    smartContractVersion: '1.0.0',
    reviewId: 'review-project-workspace',
    aiReviewVerdict: 'pass',
    recordKind: 'accepted',
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认项目页已经能够直接引导下一次闭合。',
      createdAt: '2026-08-26T09:26:00.000Z',
    },
    createdAt: '2026-08-26T09:26:00.000Z',
  },
  {
    id: 'record-product-narrative',
    projectId: 'project-writing',
    closingContractId: 'contract-narrative',
    coveredContractIds: ['contract-narrative'],
    title: '写出新的产品一句话定义',
    summary: '产品定义已经覆盖智能合约、AI 审查和用户签名三个核心概念。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    reviewId: 'review-narrative',
    aiReviewVerdict: 'pass',
    recordKind: 'accepted',
    userVerdict: {
      result: 'confirmed_complete',
      note: '这句话可以作为新的产品定义。',
      createdAt: '2026-08-24T12:03:00.000Z',
    },
    createdAt: '2026-08-24T12:03:00.000Z',
  },
  {
    id: 'record-story-structure',
    projectId: 'project-writing',
    closingContractId: 'contract-story-structure',
    coveredContractIds: ['contract-story-structure'],
    title: '写出产品介绍的三段结构',
    summary: '介绍已经按问题、规则和结果组织，并为每段提供了事实依据。',
    smartContractId: 'skill-general-contract',
    smartContractVersion: '1.0.0',
    reviewId: 'review-story-structure',
    aiReviewVerdict: 'pass',
    recordKind: 'accepted',
    userVerdict: {
      result: 'confirmed_complete',
      note: '我确认这份介绍已经能用具体事实解释产品。',
      createdAt: '2026-08-26T12:16:00.000Z',
    },
    createdAt: '2026-08-26T12:16:00.000Z',
  },
]

export const edges: ExecutionEdge[] = [
  {
    id: 'edge-contract-home',
    sourceContractId: 'contract-skill-contract',
    targetContractId: 'contract-home-redesign',
    type: 'lineage',
  },
  {
    id: 'edge-workspace-copy',
    sourceContractId: 'contract-project-workspace',
    targetContractId: 'contract-contract-copy',
    type: 'lineage',
  },
  {
    id: 'edge-home-supplement',
    sourceContractId: 'contract-home-redesign',
    targetContractId: 'contract-gap-supplement',
    type: 'supplement',
  },
  {
    id: 'edge-home-goal',
    sourceContractId: 'contract-home-redesign',
    targetContractId: 'contract-goal-lineage',
    type: 'lineage',
  },
  {
    id: 'edge-daily-reading',
    sourceContractId: 'contract-daily-output',
    targetContractId: 'contract-reading-notes',
    type: 'lineage',
  },
  {
    id: 'edge-weekly-focus',
    sourceContractId: 'contract-weekly-review',
    targetContractId: 'contract-focus-supplement',
    type: 'supplement',
  },
  {
    id: 'edge-skill-workspace',
    sourceContractId: 'contract-skill-contract',
    targetContractId: 'contract-project-workspace',
    type: 'lineage',
  },
  {
    id: 'edge-narrative-cases',
    sourceContractId: 'contract-narrative',
    targetContractId: 'contract-case-notes',
    type: 'lineage',
  },
  {
    id: 'edge-narrative-story',
    sourceContractId: 'contract-narrative',
    targetContractId: 'contract-story-structure',
    type: 'lineage',
  },
]
