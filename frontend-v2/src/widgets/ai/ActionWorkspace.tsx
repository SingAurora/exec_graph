import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import type { ActionDocumentUpdateMode, ActionExpressionContext, ActionNode, ActionReferenceAgreement } from '../../entities/action/model/types'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import { generateAIDocument, type AIConversationTurn, type AIDocumentResult } from '../../features/ai-key/api/chat'
import { ActionAgreementEditor } from '../../features/action-agreement/ui/ActionAgreementEditor'
import { MergeActionSources } from '../../features/action-merge/ui/MergeActionSources'
import { getReferenceAgreementRecords, type AIActionAgreementReview } from '../../features/ai-key/lib/action-agreement-review'
import type { ChatMessage, PostImage, UserProfile } from '../../shared/model'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { WorkspaceFrame } from './WorkspaceFrame'

type ActionWorkspaceProps = {
  profileName: string
  profile?: UserProfile
  aiConfig?: AIKeyConfig
  hasParent: boolean
  contextTitle?: string
  contextGuide?: string
  inheritedExpression?: string
  inheritedExpressionImages?: PostImage[]
  inheritedAgreement?: string
  sourceNodeId?: string
  sourceNodeNumber?: number
  actions?: ActionNode[]
  expressionSourceNumber?: number
  historyFacts?: ActionExpressionContext['facts']
  initialDocument?: string
  initialMessages?: ChatMessage[]
  onBack: () => void
  onConfirm: (markdown: string, details: { title: string; description: string; points: string[]; note: string }, messages: ChatMessage[], expressionMarkdown?: string, agreementMarkdown?: string, referenceAgreements?: ActionReferenceAgreement[], mergedParentIds?: string[]) => void
}

/** Maintains action and expression documents through one continuous AI conversation. */
export function ActionWorkspace({ profileName, profile, aiConfig, hasParent, contextTitle, contextGuide, inheritedExpression = '', inheritedExpressionImages = [], inheritedAgreement = '', sourceNodeId, sourceNodeNumber, actions, expressionSourceNumber, historyFacts = [], initialDocument = '', initialMessages, onBack, onConfirm }: ActionWorkspaceProps) {
  const welcome: ChatMessage = { id: 'welcome', speaker: 'ai', body: '先说说这次实际做了什么，也可以一起聊聊你的看法。' }
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages?.length ? initialMessages : [welcome])
  const [input, setInput] = useState('')
  const [document, setDocument] = useState(initialDocument)
  const [details, setDetails] = useState({ title: '', description: '', points: [] as string[], note: '' })
  const [sending, setSending] = useState(false)
  const [generated, setGenerated] = useState(Boolean(initialDocument))
  const [expression, setExpression] = useState<NonNullable<AIDocumentResult['expression']>>({ mode: hasParent ? 'inherit' : 'clear', markdown: '' })
  const [agreementMode, setAgreementMode] = useState<ActionDocumentUpdateMode>('inherit')
  const [agreementDraft, setAgreementDraft] = useState(inheritedAgreement)
  const [agreementReviews, setAgreementReviews] = useState<AIActionAgreementReview[]>([])
  const [mergedParentIds, setMergedParentIds] = useState<string[]>([])
  const [sourcesChanged, setSourcesChanged] = useState(false)
  const continuation = actions && sourceNodeId ? getActionContinuationContext(actions, sourceNodeId, mergedParentIds) : undefined
  const knownFacts = continuation?.facts ?? historyFacts
  const directSources = continuation?.sources.map(({ node, agreement }) => ({ sourceId: node.id, nodeNumber: node.number, markdown: agreement.markdown }))
    ?? (hasParent && sourceNodeId && sourceNodeNumber !== undefined ? [{ sourceId: sourceNodeId, nodeNumber: sourceNodeNumber, markdown: inheritedAgreement }] : [])
  const agreementMarkdown = agreementMode === 'inherit' ? undefined : agreementMode === 'clear' ? '' : agreementDraft.trim()
  const expressionMarkdown = expression.mode === 'inherit' ? undefined : expression.markdown.trim()
  const effectiveExpression = expression.mode === 'inherit' ? inheritedExpression : expression.markdown
  const sourceReview = agreementReviews.find((review) => review.nodeNumber === sourceNodeNumber)
  const expressionOriginNumber = expressionSourceNumber ?? sourceNodeNumber
  const expressionLabel = !effectiveExpression.trim() ? '表达为空' : expression.mode === 'inherit'
    ? expressionOriginNumber !== undefined ? `继承自 节点 #${expressionOriginNumber}` : '继承表达'
    : '本次对话更新'
  const contextValid = !actions || !hasParent || Boolean(continuation)
  const canPublish = Boolean(document.trim()) && generated && !sending && contextValid && !(agreementMode === 'update' && !agreementDraft.trim())
  const changeMergedSources = (ids: string[]) => {
    if (sending || !actions || !sourceNodeId) return
    const onlyRemoving = ids.every((id) => mergedParentIds.includes(id))
    if (!onlyRemoving && !getActionContinuationContext(actions, sourceNodeId, ids)) return
    setMergedParentIds(ids)
    setGenerated(false)
    setAgreementReviews([])
    setSourcesChanged(true)
  }
  const publish = () => {
    if (!canPublish) return
    const assessments = getReferenceAgreementRecords(directSources, agreementReviews)
    onConfirm(document, details, messages.filter(isSavedMessage), expressionMarkdown, agreementMarkdown, assessments, mergedParentIds)
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!clean || sending || !contextValid) return
    const next = [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'user-' + Date.now(), speaker: 'user' as const, body: clean }]
    setMessages(next); setInput(''); setSending(true); setGenerated(false); setAgreementReviews([])
    try {
      if (!aiConfig) throw new Error('还没有可用的 AI 配置，请先前往设置。')
      const turns: AIConversationTurn[] = next.filter(isSavedMessage).map((message) => ({ role: message.speaker === 'ai' ? 'assistant' : 'user', content: message.body }))
      const result = await generateAIDocument({
        config: aiConfig, mode: 'action', turns, currentDocument: document, contextGuide,
        sourceAgreements: directSources,
        downstreamAgreement: agreementMarkdown ?? inheritedAgreement,
        hasParent, inheritedExpression, currentExpression: expression, historyFacts: knownFacts,
      })
      setDocument(result.document); setDetails(result.details)
      if (result.expression) setExpression(result.expression)
      setAgreementReviews(result.agreementReviews ?? [])
      setMessages((current) => [...current, { id: 'ai-' + Date.now(), speaker: 'ai', body: result.reply }])
      setGenerated(true)
      setSourcesChanged(false)
    } catch (error) {
      setMessages([...messages.filter((message) => !message.id.startsWith('error-')), { id: 'error-' + Date.now(), speaker: 'ai', body: '暂时无法更新记录：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。') }])
      setInput(clean)
    } finally { setSending(false) }
  }

  return <WorkspaceFrame title={hasParent ? '接续行动' : '记录第一次行动'} tabLabel="接续行动工作区"
    help={<HelpPopover title="行动与表达的整理"><p>在同一条对话中描述实际行动、讨论看法，AI 分别整理行动和表达。表达的修改、继承与清空都可在对话中说明，切换到行动或表达查看文档预览，切换到约定设置后续引用要求。</p><p>{hasParent ? '未提出修改时沿用承接节点的表达，合入来源不会自动覆盖表达。' : '首次行动没有上级表达，可以暂不填写。'}发布后修改表达也会接着这条对话继续。</p></HelpPopover>}
    context={hasParent ? { label: sourceNodeNumber !== undefined ? `承接 #${sourceNodeNumber}` : '承接', title: contextTitle, facts: knownFacts } : undefined}
    contextControls={hasParent && actions && sourceNodeId ? <MergeActionSources actions={actions} parentId={sourceNodeId} selectedIds={mergedParentIds} reviews={agreementReviews} disabled={sending} onChange={changeMergedSources} /> : undefined}
    messages={messages} profileName={profileName} profile={profile} input={input} placeholder="说说做了什么，或想表达什么"
    sending={sending} disabled={!contextValid} onInputChange={setInput} onSend={send} onBack={onBack}
    action={{ markdown: document, status: sourcesChanged && document ? '引用背景已更新，文档待重新整理' : undefined, empty: '在 AI 对话中描述这次行动' }}
    expression={{ markdown: effectiveExpression, images: expression.mode === 'inherit' ? inheritedExpressionImages : [], status: expressionLabel, empty: '暂无表达' }}
    agreement={<ActionAgreementEditor hasParent={hasParent} inheritedAgreement={inheritedAgreement} mode={agreementMode} draft={agreementDraft} onModeChange={setAgreementMode} onDraftChange={setAgreementDraft} disabled={sending} sourceNodeNumber={sourceNodeNumber} sourceReview={sourceReview} sources={continuation?.sources} reviews={agreementReviews} />}
    footer={<><span className="text-xs text-muted" role="status">{sending ? '正在整理…' : !contextValid ? '引用来源已变化，请返回重新选择' : sourcesChanged ? '引用背景已更新，请继续对话后发布' : !document ? '尚未生成' : !generated ? '本轮未完成' : '待发布'}</span>
      <button className="primary-button" type="button" onClick={publish} disabled={!canPublish}><Check size={15} />发布行动</button></>} />
}

function isSavedMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
