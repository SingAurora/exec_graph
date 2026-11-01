import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { ActionExpressionContext, ActionNode } from '../../entities/action/model/types'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import { resourceId } from '../../shared/lib/resource-id'
import { DraftImages } from '../../features/media-upload/ui/DraftImages'
import type { GenerateInput, GenerationRequest } from '../../features/action-generation/api/generation'
import { documentUpdate, type CreateActionInput } from '../../features/action/api/commands'
import { MergeActionSources } from '../../features/action-merge/ui/MergeActionSources'
import type { ChatMessage, PostImage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { WorkspaceFrame } from './WorkspaceFrame'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { BusinessRequestError } from '../../shared/api/errors'
import { MarkdownContent } from '../../shared/ui/MarkdownContent'
import { appendWorkspaceError, createWorkspaceView, isActionWorkspaceDraft, reconcileWorkspaceDraft, type ActionWorkspaceDraft } from './model/workspace-draft'

type ActionWorkspaceProps = {
  graphId: string
  csrfToken: string
  profileName: string
  profile?: UserProfile
  draftKey?: string
  hasParent: boolean
  contextTitle?: string
  contextGuide?: string
  inheritedExpression?: string
  inheritedExpressionImages?: PostImage[]
  inheritedAgreement?: string
  sourceNodeId?: string
  sourceNodeNumber?: number
  actions?: (ActionNode & { version?: number })[]
  historyFacts?: ActionExpressionContext['facts']
  initialDocument?: string
  initialMessages?: ChatMessage[]
  onBack: () => void
  onConfirm: (input: CreateActionInput) => boolean | Promise<boolean>
}

/** 行动发布工作区：同一条 AI 对话整理行动事实与表达，另行设置后续约定并核对来源。 */
export function ActionWorkspace({ graphId, csrfToken, profileName, profile, draftKey, hasParent, contextTitle, contextGuide, inheritedExpression = '', inheritedExpressionImages = [], inheritedAgreement = '', sourceNodeId, sourceNodeNumber, actions, historyFacts = [], initialDocument = '', initialMessages, onBack, onConfirm }: ActionWorkspaceProps) {
  const generate = useGeneration(csrfToken)
  const welcome: ChatMessage = { id: 'welcome', speaker: 'ai', body: '先说说这次实际做了什么。' }
  // 背景签名用于判断草稿是否仍对应当前引用事实；来源变化后必须再对话核实，不能直接发布旧结果。
  const signatureFor = (mergedIds: string[]) => {
    const context = actions && sourceNodeId ? getActionContinuationContext(actions, sourceNodeId, mergedIds) : undefined
    return JSON.stringify({ sourceNodeId, mergedIds, contextGuide, inheritedExpression, inheritedAgreement,
      facts: context?.facts ?? historyFacts, sources: context?.sources.map(({ node, agreement }) => [node.id, actions?.find((item) => item.id === node.id)?.version, agreement.markdown]) })
  }
  // 对话、文档和预览位置作为一份本地草稿保存；恢复完成前禁止编辑，避免初始空值覆盖旧草稿。
  const local = useLocalDraft<ActionWorkspaceDraft>({
    draftKey,
    initialValue: { messages: initialMessages?.length ? initialMessages : [welcome], input: '', document: initialDocument,
      details: { title: '', description: '', points: [], note: '' }, generated: Boolean(initialDocument),
      expression: { mode: hasParent ? 'inherit' : 'clear', markdown: '' }, agreementMode: 'inherit', agreementDraft: inheritedAgreement,
      agreementReviews: [], mergedParentIds: [], sourcesChanged: false, contextSignature: signatureFor([]), view: createWorkspaceView() },
    validate: isActionWorkspaceDraft,
    restore: (saved) => {
      const normalized = { ...saved, mergedParentIds: saved.mergedParentIds.map((id) => resourceId(actions ?? [], id) ?? id) }
      const restored = reconcileWorkspaceDraft(normalized, signatureFor(normalized.mergedParentIds))
      return restored === normalized ? normalized : { ...restored, sourcesChanged: true, agreementReviews: [] }
    },
    hasContent: (value) => Boolean(value.input || value.document || value.messages.some(isSavedMessage)
      || value.agreementMode !== 'inherit' || value.agreementDraft !== inheritedAgreement || value.mergedParentIds.length || value.images?.length),
  })
  const { messages, input, document, generated, agreementReviews, mergedParentIds, sourcesChanged, generation, generationRequest } = local.value
  const update = (patch: Partial<ActionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const [sending, setSending] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [publishError, setPublishError] = useState('')
  const continuation = actions && sourceNodeId ? getActionContinuationContext(actions, sourceNodeId, mergedParentIds) : undefined
  const knownFacts = continuation?.facts ?? historyFacts
  const directSources = continuation?.sources.map(({ node, agreement }) => ({ sourceId: node.id, nodeNumber: node.number, markdown: agreement.markdown }))
    ?? (hasParent && sourceNodeId && sourceNodeNumber !== undefined ? [{ sourceId: sourceNodeId, nodeNumber: sourceNodeNumber, markdown: inheritedAgreement }] : [])
  // 传给应用层的 undefined 表示继承，空字符串表示清空，两者不能用 || 互相替代。
  const agreementIntent = documentUpdate(hasParent ? undefined : '')
  const effectiveExpression = inheritedExpression
  const contextValid = !actions || !hasParent || Boolean(continuation)
  // 发布要求本轮生成完整且背景未变；约定核对为不满足或未知时，仍允许发布并如实保留状态。
  const canPublish = local.ready && Boolean(document.trim()) && generated && Boolean(generation?.createAction) && !sending && !publishing && !uploading && contextValid
    && JSON.stringify(generationRequest?.input.agreement) === JSON.stringify(agreementIntent)
    && local.value.contextSignature === signatureFor(mergedParentIds)
  const changeMergedSources = (ids: string[]) => {
    if (sending || !actions || !sourceNodeId) return
    const onlyRemoving = ids.every((id) => mergedParentIds.includes(id))
    if (!onlyRemoving && !getActionContinuationContext(actions, sourceNodeId, ids)) return
    // 合入影响 AI 可用事实，因此保留旧文稿供阅读，同时清除过时的核对结果和可发布标记。
    update({ mergedParentIds: ids, generated: false, agreementReviews: [], sourcesChanged: true })
  }
  const publish = async () => {
    if (!canPublish) return
    setPublishing(true); setPublishError('')
    try {
      // 父层确认业务写入成功后才能删除草稿；失败时对话和文档继续保留，允许重试。
      if (generation?.createAction && await onConfirm({ ...generation.createAction, images: (local.value.images ?? []).map((image) => ({ assetId: image.assetId!, alt: image.alt })) })) local.remove()
      else setPublishError('节点状态已变化，无法发布行动')
    } catch (error) { setPublishError(error instanceof Error ? error.message : '发布失败，请重试') }
    finally { setPublishing(false) }
  }

  const send = async (event: FormEvent) => {
    // 阻止浏览器表单整页刷新，改由 React 管理异步请求和输入状态。
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || publishing || uploading || !contextValid) return
    const next = [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'user-' + Date.now(), speaker: 'user' as const, body: clean }]
    const requestInput: GenerateInput = { mode: 'action', graphId, message: clean, conversationId: generation?.conversationId,
      parentId: sourceNodeId, mergedParentIds, sourceVersions: directSources.map(({ sourceId }) => ({ nodeId: sourceId, version: actions?.find((node) => node.id === sourceId)?.version ?? 0 })), agreement: agreementIntent }
    // 响应丢失时重试相同提交；新的对话输入分配新的提交身份。
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, agreementReviews: [], generationRequest: request }); setSending(true); setPublishError('')
    try {
      const result = await generate(request)
      update({ generation: result })
      if (result.status !== 'succeeded' || !result.draft || !result.createAction) throw new Error(result.status === 'pending' ? '仍在整理，请稍后重试读取结果' : '整理失败，请重新发送')
      const draft = result.draft
      local.update((current) => ({ ...current, generation: result, document: draft.objective, details: { title: draft.title, description: '', points: [], note: '' }, expression: { mode: hasParent ? 'inherit' : 'clear', markdown: '' }, agreementMode: 'inherit', agreementDraft: inheritedAgreement,
        agreementReviews: draft.reviews.map((review) => ({ nodeNumber: actions?.find((node) => node.id === review.sourceId)?.number ?? 0, complies: review.complies, reason: review.exceptionReason ?? '' })), messages: [...current.messages, { id: 'ai-' + result.generationId, speaker: 'ai', body: draft.reply }],
        generated: true, sourcesChanged: false, contextSignature: signatureFor(mergedParentIds) }))
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败，请稍后重试。'
      const prefix = error instanceof BusinessRequestError && error.kind === 'business' && error.code === 10001 ? '' : '暂时无法更新记录：'
      local.update((current) => ({ ...current, messages: appendWorkspaceError(current.messages, prefix + message), input: clean }))
    } finally { setSending(false) }
  }

  return (
    <WorkspaceFrame title={hasParent ? '接续行动' : '记录第一次行动'}
      tabs={['conversation', 'objective']}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || publishing || uploading || !local.ready} onDiscard={() => { local.discard(); setPublishError('') }} />}
      help={<HelpPopover title="行动"><p>这里仅记录本次实际行动，并核对你引用的来源节点约定。发布后，表达和向后传递的约定分别通过独立对话整理。</p><p>{hasParent ? '新节点默认沿用承接节点的表达与约定。' : '首次行动暂时没有可继承的表达或约定。'}合入来源只补充行动背景，不覆盖承接节点的表达和约定。</p></HelpPopover>}
      context={hasParent ? { label: sourceNodeNumber !== undefined ? `承接 #${sourceNodeNumber}` : '承接', title: contextTitle, facts: knownFacts } : undefined}
      contextControls={hasParent && actions && sourceNodeId ? <MergeActionSources actions={actions} parentId={sourceNodeId} selectedIds={mergedParentIds} reviews={agreementReviews} disabled={sending || publishing || !local.ready} onChange={changeMergedSources} /> : undefined}
      messages={messages} profileName={profileName} profile={profile} input={input} placeholder="说说这次实际做了什么"
      sending={sending} disabled={publishing || uploading || !local.ready || !contextValid} onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      actionControls={<DraftImages images={local.value.images ?? []} csrfToken={csrfToken} ready={local.ready} disabled={sending || publishing} onChange={(images) => update({ images })} onBusyChange={setUploading} />}
      action={{ markdown: document, status: sourcesChanged && document ? '引用背景已更新，文档待重新整理' : undefined, empty: '在 AI 对话中描述这次行动' }}
      expression={{ markdown: effectiveExpression, images: inheritedExpressionImages, status: hasParent ? '沿用承接节点表达' : '暂无表达', empty: '暂无表达' }}
      agreement={<div className="px-6">
        {inheritedAgreement.trim() ? <MarkdownContent markdown={inheritedAgreement} /> : <p className="py-5 text-sm text-muted">{hasParent ? '承接节点没有可继承的约定' : '暂无约定'}</p>}
        <p className="mt-4 text-xs text-muted">发布后可在约定工作区单独整理向后传递的约定。</p>
        {directSources.length > 0 && <section className="mt-5 border-t border-line pt-4">
          <h3 className="mb-3 text-xs font-medium">本次来源约定核对</h3>
          <div className="divide-y divide-line">{directSources.map((source) => {
            const review = agreementReviews.find((item) => item.nodeNumber === source.nodeNumber)
            const status = review?.complies === true ? '满足约定' : review?.complies === false ? '不满足约定' : '尚未核对'
            return <div className="py-3" key={source.sourceId}>
              <p className="mb-1 flex items-center justify-between gap-3 text-xs"><span>节点 #{source.nodeNumber}</span><span className={review?.complies === false ? 'text-coral' : review?.complies === true ? 'text-signal' : 'text-muted'}>{status}</span></p>
              {source.markdown ? <MarkdownContent markdown={source.markdown} /> : <p className="text-xs text-muted">来源没有设置约定</p>}
              {review?.reason && <p className="mt-2 text-xs text-muted">不符合原因：{review.reason}</p>}
            </div>
          })}</div>
        </section>}
      </div>}
      footer={<><span className="text-xs text-muted">{publishError || (sending ? '正在整理…' : !contextValid ? '引用来源已变化，请返回重新选择' : sourcesChanged ? '引用背景已更新，请继续对话后发布' : !document ? '尚未生成' : !generated ? '本轮未完成' : '待发布')}</span>
        <button className="primary-button" type="button" onClick={publish} disabled={!canPublish}><Check size={15} />发布行动</button></>} />
  )
}

function isSavedMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
