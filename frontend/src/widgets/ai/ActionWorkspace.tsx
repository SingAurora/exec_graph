import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import type { ActionExpressionContext, ActionNode, ActionReferenceAgreement } from '../../entities/action/model/types'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import { generateAIDocument, type AIConversationTurn } from '../../features/ai-key/api/chat'
import { ActionAgreementEditor } from '../../features/action-agreement/ui/ActionAgreementEditor'
import { MergeActionSources } from '../../features/action-merge/ui/MergeActionSources'
import { getReferenceAgreementRecords } from '../../features/ai-key/lib/action-agreement-review'
import type { ChatMessage, PostImage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { WorkspaceFrame } from './WorkspaceFrame'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { createWorkspaceView, isActionWorkspaceDraft, reconcileWorkspaceDraft, type ActionWorkspaceDraft } from './model/workspace-draft'

type ActionWorkspaceProps = {
  profileName: string
  profile?: UserProfile
  aiConfig?: AIKeyConfig
  draftKey?: string
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
  onConfirm: (markdown: string, details: { title: string; description: string; points: string[]; note: string }, messages: ChatMessage[], expressionMarkdown?: string, agreementMarkdown?: string, referenceAgreements?: ActionReferenceAgreement[], mergedParentIds?: string[]) => boolean | Promise<boolean>
}

/** Maintains action and expression documents through one continuous AI conversation. */
export function ActionWorkspace({ profileName, profile, aiConfig, draftKey, hasParent, contextTitle, contextGuide, inheritedExpression = '', inheritedExpressionImages = [], inheritedAgreement = '', sourceNodeId, sourceNodeNumber, actions, expressionSourceNumber, historyFacts = [], initialDocument = '', initialMessages, onBack, onConfirm }: ActionWorkspaceProps) {
  const welcome: ChatMessage = { id: 'welcome', speaker: 'ai', body: '先说说这次实际做了什么，也可以一起聊聊你的看法。' }
  const signatureFor = (mergedIds: string[]) => {
    const context = actions && sourceNodeId ? getActionContinuationContext(actions, sourceNodeId, mergedIds) : undefined
    return JSON.stringify({ sourceNodeId, mergedIds, contextGuide, inheritedExpression, inheritedAgreement,
      facts: context?.facts ?? historyFacts, sources: context?.sources.map(({ node, agreement }) => [node.id, agreement.markdown]) })
  }
  const local = useLocalDraft<ActionWorkspaceDraft>({
    draftKey,
    initialValue: { messages: initialMessages?.length ? initialMessages : [welcome], input: '', document: initialDocument,
      details: { title: '', description: '', points: [], note: '' }, generated: Boolean(initialDocument),
      expression: { mode: hasParent ? 'inherit' : 'clear', markdown: '' }, agreementMode: 'inherit', agreementDraft: inheritedAgreement,
      agreementReviews: [], mergedParentIds: [], sourcesChanged: false, contextSignature: signatureFor([]), view: createWorkspaceView() },
    validate: isActionWorkspaceDraft,
    restore: (saved) => {
      const restored = reconcileWorkspaceDraft(saved, signatureFor(saved.mergedParentIds))
      return restored === saved ? saved : { ...restored, sourcesChanged: true, agreementReviews: [] }
    },
    hasContent: (value) => Boolean(value.input || value.document || value.messages.some(isSavedMessage)
      || value.agreementMode !== 'inherit' || value.agreementDraft !== inheritedAgreement || value.mergedParentIds.length),
  })
  const { messages, input, document, details, generated, expression, agreementMode, agreementDraft, agreementReviews, mergedParentIds, sourcesChanged } = local.value
  const update = (patch: Partial<ActionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const [sending, setSending] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
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
  const canPublish = local.ready && Boolean(document.trim()) && generated && !sending && !publishing && contextValid
    && local.value.contextSignature === signatureFor(mergedParentIds) && !(agreementMode === 'update' && !agreementDraft.trim())
  const changeMergedSources = (ids: string[]) => {
    if (sending || !actions || !sourceNodeId) return
    const onlyRemoving = ids.every((id) => mergedParentIds.includes(id))
    if (!onlyRemoving && !getActionContinuationContext(actions, sourceNodeId, ids)) return
    update({ mergedParentIds: ids, generated: false, agreementReviews: [], sourcesChanged: true })
  }
  const publish = async () => {
    if (!canPublish) return
    setPublishing(true); setPublishError('')
    const assessments = getReferenceAgreementRecords(directSources, agreementReviews)
    try {
      if (await onConfirm(document, details, messages.filter(isSavedMessage), expressionMarkdown, agreementMarkdown, assessments, mergedParentIds)) local.remove()
      else setPublishError('节点状态已变化，无法发布行动')
    } catch (error) { setPublishError(error instanceof Error ? error.message : '发布失败，请重试') }
    finally { setPublishing(false) }
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || publishing || !contextValid) return
    const next = [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'user-' + Date.now(), speaker: 'user' as const, body: clean }]
    update({ messages: next, input: '', generated: false, agreementReviews: [] }); setSending(true); setPublishError('')
    try {
      if (!aiConfig) throw new Error('还没有可用的 AI 配置，请先前往设置。')
      const turns: AIConversationTurn[] = next.filter(isSavedMessage).map((message) => ({ role: message.speaker === 'ai' ? 'assistant' : 'user', content: message.body }))
      const result = await generateAIDocument({
        config: aiConfig, mode: 'action', turns, currentDocument: document, contextGuide,
        sourceAgreements: directSources,
        downstreamAgreement: agreementMarkdown ?? inheritedAgreement,
        hasParent, inheritedExpression, currentExpression: expression, historyFacts: knownFacts,
      })
      local.update((current) => ({ ...current, document: result.document, details: result.details, expression: result.expression ?? current.expression,
        agreementReviews: result.agreementReviews ?? [], messages: [...current.messages, { id: 'ai-' + Date.now(), speaker: 'ai', body: result.reply }],
        generated: true, sourcesChanged: false, contextSignature: signatureFor(mergedParentIds) }))
    } catch (error) {
      update({ messages: [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'error-' + Date.now(), speaker: 'ai', body: '暂时无法更新记录：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。') }], input: clean })
    } finally { setSending(false) }
  }

  return <WorkspaceFrame title={hasParent ? '接续行动' : '记录第一次行动'} tabLabel="接续行动工作区"
    view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
    draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || publishing || !local.ready} onDiscard={() => { local.discard(); setPublishError('') }} />}
    help={<HelpPopover title="行动与表达的整理"><p>在同一条对话中描述实际行动、讨论看法，AI 分别整理行动和表达。表达的修改、继承与清空都可在对话中说明，切换到行动或表达查看文档预览，切换到约定设置后续引用要求。</p><p>{hasParent ? '未提出修改时沿用承接节点的表达，合入来源不会自动覆盖表达。' : '首次行动没有上级表达，可以暂不填写。'}发布后修改表达也会接着这条对话继续。</p></HelpPopover>}
    context={hasParent ? { label: sourceNodeNumber !== undefined ? `承接 #${sourceNodeNumber}` : '承接', title: contextTitle, facts: knownFacts } : undefined}
    contextControls={hasParent && actions && sourceNodeId ? <MergeActionSources actions={actions} parentId={sourceNodeId} selectedIds={mergedParentIds} reviews={agreementReviews} disabled={sending || publishing || !local.ready} onChange={changeMergedSources} /> : undefined}
    messages={messages} profileName={profileName} profile={profile} input={input} placeholder="说说做了什么，或想表达什么"
    sending={sending} disabled={publishing || !local.ready || !contextValid} onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
    action={{ markdown: document, status: sourcesChanged && document ? '引用背景已更新，文档待重新整理' : undefined, empty: '在 AI 对话中描述这次行动' }}
    expression={{ markdown: effectiveExpression, images: expression.mode === 'inherit' ? inheritedExpressionImages : [], status: expressionLabel, empty: '暂无表达' }}
    agreement={<ActionAgreementEditor hasParent={hasParent} inheritedAgreement={inheritedAgreement} mode={agreementMode} draft={agreementDraft} onModeChange={(agreementMode) => update({ agreementMode })} onDraftChange={(agreementDraft) => update({ agreementDraft })} disabled={sending || publishing || !local.ready} sourceNodeNumber={sourceNodeNumber} sourceReview={sourceReview} sources={continuation?.sources} reviews={agreementReviews} />}
    footer={<><span className="text-xs text-muted" role="status">{publishError || (sending ? '正在整理…' : !contextValid ? '引用来源已变化，请返回重新选择' : sourcesChanged ? '引用背景已更新，请继续对话后发布' : !document ? '尚未生成' : !generated ? '本轮未完成' : '待发布')}</span>
      <button className="primary-button" type="button" onClick={publish} disabled={!canPublish}><Check size={15} />发布行动</button></>} />
}

function isSavedMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
