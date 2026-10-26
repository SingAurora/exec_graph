import type { ChatMessage, PostImage } from '../../../shared/model/content'

/** 原型接续入口保留的模式；实际引用关系由 parentId 和 mergedParentIds 表达。 */
export type BranchMode = 'continue' | 'fork'

/** 发布后的最近一次文档编辑；旧记录没有 kind 时按手动补充理解。 */
export type ActionDocumentRevision = {
  authorId: string
  createdAt: string
  kind?: 'supplement' | 'modify' | 'clear'
}

/** 继续修改表达时的聊天消息，可记录实际参与该轮对话的用户。 */
export type ActionExpressionMessage = ChatMessage & { authorId?: string }

/** 本次引用对某个直接来源的约定核对；模型中缺少记录表示未核对，接口用 null 传递。 */
export type ActionReferenceAgreement = {
  sourceId: string
  complies: boolean
  exceptionReason?: string
}

/**
 * 已发布的行动节点：一次真实经历，同时承载表达、后续约定及指向来源的引用。
 * 表达是供人阅读的看法；满足来源约定的跨用户引用可传达沟通意愿，核对记录随引用保存。
 * 节点记录已发生的事，不包含待办目标或完成状态。
 */
export type ActionNode = {
  legacyId?: string
  /** 资源身份，用于查找、引用和更新；不能用展示编号代替。 */
  id: string
  /** 所属行动图；旧 UI 沿用 projectId，请求 DTO 使用 graphId 并在 API 层显式映射。 */
  projectId: string
  /** 图内稳定展示编号，和引用深度（第几层）分别计算。 */
  number: number
  /** 主要承接来源；表达和后续约定只沿这条关系继承。 */
  parentId?: string
  /** 额外引用的背景来源，参与事实上下文，但不会自动覆盖承接来源的表达／约定。 */
  mergedParentIds?: string[]
  /** 留给后来引用者的约定：undefined 沿承接来源继承，空字符串主动清空，非空则设新版本。 */
  agreementMarkdown?: string
  /** 后续约定的最近一次手动编辑信息，与原始行动对话分开保存。 */
  agreementSupplement?: ActionDocumentRevision
  /** 本次引用是否满足各直接来源的约定，与本节点向后提出的 agreementMarkdown 分开。 */
  referenceAgreements?: ActionReferenceAgreement[]
  authorId: string
  title: string
  markdown: string
  /** 只记本次实际发生的事实；旧记录缺少此字段时才回退读取 markdown。 */
  objectiveMarkdown?: string
  /** 基于行动形成的看法：undefined 继承，空字符串主动清空，非空则使用本节点表达。 */
  expressionMarkdown?: string
  /** 表达的最近一次修改信息；修改通过延续既有对话完成，不新增行动。 */
  expressionSupplement?: ActionDocumentRevision
  /** 发布后追加的表达对话，与原始 conversation 连续阅读，但不改写原始消息。 */
  expressionConversation?: ActionExpressionMessage[]
  /** 保存的来源摘要；用于追溯背景，不等同于完整的 AI 请求日志。 */
  contextSnapshot?: { directNodeIds: string[]; historyNodeCount: number; guide?: string }
  images: PostImage[]
  conversation: ChatMessage[]
  createdAt: string
}

/** 解析继承后的有效表达，以及最后设置或清空这份表达的节点。 */
export type ActionExpression = {
  markdown: string
  sourceNode?: ActionNode
}

/** 修改表达可用的事实：仅本节点和引用历史，排除图内无关分支。 */
export type ActionExpressionContext = {
  nodeNumber: number
  facts: { number: number; authorId: string; title: string; markdown: string }[]
}

/** 解析继承后的有效约定，以及最后设置或清空约定的节点。 */
export type ActionAgreement = {
  markdown: string
  sourceNode?: ActionNode
}

/** 待发布行动的一个直接来源，包括承接／合入类型和该来源的有效约定。 */
export type ActionContinuationSource = {
  node: ActionNode
  kind: 'primary' | 'merged'
  agreement: ActionAgreement
}

/** 当前约定继承或修改自哪一份真实来源版本。 */
export type ActionAgreementOrigin = {
  kind: 'modified' | 'inherited'
  node: ActionNode
}

/** 当前表达继承或修改自哪一份真实来源版本。 */
export type ActionExpressionOrigin = {
  kind: 'modified' | 'inherited'
  node: ActionNode
}

/** 表达的处理状态；形成过程需区分首次填写、修改、继承、清空和原本为空。 */
export type ActionExpressionChange = {
  kind: 'initial' | 'modified' | 'inherited' | 'cleared' | 'empty'
  source?: ActionNode
}

/** 节点内可分别阅读的两份文档：行动事实与行动表达。 */
export type ActionDocumentMode = 'objective' | 'expression'

/** 接续时对表达／约定的三种独立选择：继承、更新、清空。 */
export type ActionDocumentUpdateMode = 'inherit' | 'update' | 'clear'

/** 尚未发布的行动文稿及其整理对话，不属于已发布的业务事实。 */
export type ActionDraft = {
  title: string
  markdown: string
  conversation: ChatMessage[]
}
