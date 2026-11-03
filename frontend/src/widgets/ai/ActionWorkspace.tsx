import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ActionExpressionContext, ActionNode } from '../../entities/action/model/types'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import { resourceId } from '../../shared/lib/resource-id'
import { DraftImages } from '../../features/media-upload/ui/DraftImages'
import { placeGenerationImages, type GenerateInput, type GenerationRequest } from '../../features/action-generation/api/generation'
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
import { appendWorkspaceError, appendWorkspaceNotice, createWorkspaceView, isActionWorkspaceDraft, normalizeGenerationRequest, pendingReportsForRestore, reconcileWorkspaceDraft, type ActionWorkspaceDraft } from './model/workspace-draft'

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
    initialValue: { messages: initialMessages?.length ? initialMessages : [welcome], pendingReports: [], input: '', document: initialDocument,
      details: { title: '', description: '', points: [], note: '' }, generated: Boolean(initialDocument),
      expression: { mode: hasParent ? 'inherit' : 'clear', markdown: '' }, agreementMode: 'inherit', agreementDraft: inheritedAgreement,
      agreementReviews: [], mergedParentIds: [], sourcesChanged: false, imagePlacementPending: false, contextSignature: signatureFor([]), view: createWorkspaceView() },
    validate: isActionWorkspaceDraft,
    restore: (saved) => {
      const generationRequest = normalizeGenerationRequest(saved.generationRequest)
      const normalized = { ...saved, generationRequest, pendingReports: [], input: saved.input || pendingReportsForRestore(saved).join('\n\n'), mergedParentIds: saved.mergedParentIds.map((id) => resourceId(actions ?? [], id) ?? id) }
      const restored = reconcileWorkspaceDraft(normalized, signatureFor(normalized.mergedParentIds))
      return restored === normalized ? normalized : { ...restored, sourcesChanged: true, agreementReviews: [], verificationStatus: 'unverified' }
    },
    hasContent: (value) => Boolean(value.input || value.document || value.messages.some(isSavedMessage)
      || value.agreementMode !== 'inherit' || value.agreementDraft !== inheritedAgreement || value.mergedParentIds.length || value.images?.length),
  })
  const { messages, input, document, images = [], imagePlacementPending = false, generated, verificationStatus = 'unverified', agreementReviews, mergedParentIds, sourcesChanged, generation, generationRequest } = local.value
  const update = (patch: Partial<ActionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const signatureForRef = useRef(signatureFor)
  const updateRef = useRef(update)
  signatureForRef.current = signatureFor
  updateRef.current = update
  const [sending, setSending] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [composerMode, setComposerMode] = useState<'conversation' | 'image'>('conversation')
  const [publishError, setPublishError] = useState('')
  const changeImages = (next: PostImage[]) => { update({ images: next, imagePlacementPending: next.length > 0 || Boolean(generation?.draft?.images?.length), verificationStatus: 'unverified' }); setPublishError('') }
  const continuation = actions && sourceNodeId ? getActionContinuationContext(actions, sourceNodeId, mergedParentIds) : undefined
  const knownFacts = continuation?.facts ?? historyFacts
  const directSources = continuation?.sources.map(({ node, agreement }) => ({ sourceId: node.id, nodeNumber: node.number, markdown: agreement.markdown }))
    ?? (hasParent && sourceNodeId && sourceNodeNumber !== undefined ? [{ sourceId: sourceNodeId, nodeNumber: sourceNodeNumber, markdown: inheritedAgreement }] : [])
  // 传给应用层的 undefined 表示继承，空字符串表示清空，两者不能用 || 互相替代。
  const agreementIntent = documentUpdate(hasParent ? undefined : '')
  const effectiveExpression = inheritedExpression
  const actionImages: PostImage[] = (generation?.draft?.images ?? []).flatMap(({ assetId, alt }) => {
    const image = images.find((item) => item.assetId === assetId)
    return image ? [{ ...image, alt }] : []
  })
  const contextValid = !actions || !hasParent || Boolean(continuation)
  // 发布要求本轮生成完整、用户已核验且背景未变；来源约定明确不满足时核验失败，未知仍可发布并保留详情。
  const canPublish = local.ready && Boolean(document.trim()) && generated && verificationStatus === 'passed' && Boolean(generation?.createAction) && !input.trim() && !sending && !publishing && !uploading && contextValid
    && JSON.stringify(generationRequest?.input.agreement) === JSON.stringify(agreementIntent)
    && local.value.contextSignature === signatureFor(mergedParentIds) && !imagePlacementPending
  const agreementSources = directSources.filter((source) => source.markdown.trim())
  const agreementStats = agreementSources.reduce((stats, source) => {
    const review = agreementReviews.find((item) => item.nodeNumber === source.nodeNumber)
    if (review?.complies === true) stats.passed += 1
    else if (review?.complies === false) stats.failed += 1
    else stats.unknown += 1
    return stats
  }, { passed: 0, failed: 0, unknown: 0 })
  // 发布按钮只属于“行动”栏目；AI 对话下方只保留状态和切栏提示。
  const viewingAction = local.value.view.tab === 'objective'
  const workspaceStatus = verificationStatus === 'passed'
    ? { text: '核验成功', tone: 'signal' as const }
    : verificationStatus === 'failed'
      ? { text: '核验失败', tone: 'coral' as const }
      : { text: '未核验', tone: 'muted' as const }
  // 生成阶段已经执行自动核验；这里由用户主动确认，并把三态状态写入草稿。
  const verifyDraft = () => {
    if (!generated || !generation?.draft || sending || publishing || !contextValid || sourcesChanged) return
    const failed = agreementStats.failed > 0
    const next = failed ? 'failed' as const : 'passed' as const
    const detail = failed
      ? `核验失败：${agreementSources.filter((source) => agreementReviews.find((item) => item.nodeNumber === source.nodeNumber)?.complies === false).map((source) => `节点 #${source.nodeNumber}`).join('、')} 的来源约定不满足，请修改后重新整理。`
      : agreementStats.unknown > 0
        ? `核验成功。${agreementStats.unknown} 条来源约定尚未提及，详情可在约定栏查看。`
        : '核验成功，当前草稿可以发布。'
    update({ verificationStatus: next })
    local.update((current) => ({ ...current, verificationStatus: next, messages: appendWorkspaceNotice(current.messages, detail) }))
  }
  const agreementIndicator = agreementSources.length > 0
    ? <button className="text-button gap-1 text-[11px] leading-4" type="button" onClick={() => update({ view: { ...local.value.view, tab: 'agreement' } })} title="查看约定核对详情">约定 {agreementStats.passed}/{agreementSources.length} 满足{agreementStats.failed > 0 ? ` · ${agreementStats.failed} 不满足` : agreementStats.unknown > 0 ? ` · ${agreementStats.unknown} 未知` : ''}</button>
    : null
  // 来源或引用版本变化时，旧核验结果不再有效；保留草稿供阅读，但要求重新核验。
  useEffect(() => {
    if (!local.ready) return
    const current = signatureForRef.current(mergedParentIds)
    if (local.value.contextSignature !== current && (generated || verificationStatus !== 'unverified' || !sourcesChanged)) {
      updateRef.current({ generated: false, verificationStatus: 'unverified', sourcesChanged: true, agreementReviews: [] })
    }
  }, [actions, contextGuide, generated, inheritedAgreement, inheritedExpression, mergedParentIds, sourcesChanged, verificationStatus, local.ready, local.value.contextSignature])
  const changeMergedSources = (ids: string[]) => {
    if (sending || !actions || !sourceNodeId) return
    const onlyRemoving = ids.every((id) => mergedParentIds.includes(id))
    if (!onlyRemoving && !getActionContinuationContext(actions, sourceNodeId, ids)) return
    // 合入影响 AI 可用事实，因此保留旧文稿供阅读，同时清除过时的核对结果和可发布标记。
    update({ mergedParentIds: ids, generated: false, agreementReviews: [], sourcesChanged: true, verificationStatus: 'unverified' })
  }
  const publish = async () => {
    if (!canPublish) return
    setPublishing(true); setPublishError('')
    try {
      // 父层确认业务写入成功后才能删除草稿；失败时对话和文档继续保留，允许重试。
      if (generation?.createAction && await onConfirm(generation.createAction)) local.remove()
      else setPublishError('节点状态已变化，无法发布行动')
    } catch (error) {
      const message = error instanceof Error ? error.message : '发布失败，请重试'
      setPublishError(message)
      if (/变化|更新|不连续|过期/.test(message)) update({ verificationStatus: 'unverified' })
    }
    finally { setPublishing(false) }
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || publishing || uploading || !contextValid) return
    if (/^核验(一下)?[。！!]?$/.test(clean)) {
      const nextMessages = [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'user-verify-' + Date.now(), speaker: 'user' as const, body: clean }]
      update({ messages: nextMessages, input: '' })
      if (!generated || !generation?.draft) {
        local.update((current) => ({ ...current, messages: appendWorkspaceNotice(current.messages, '请先在对话中整理出可核验的行动草稿。') }))
        return
      }
      verifyDraft()
      return
    }
    const next = [...messages.filter((message) => !message.id.startsWith('error-')), { id: 'user-' + Date.now(), speaker: 'user' as const, body: clean }]
    const requestInput: GenerateInput = { mode: 'action', graphId, messages: [clean], conversationId: generation?.conversationId,
      parentId: sourceNodeId, mergedParentIds, sourceVersions: directSources.map(({ sourceId }) => ({ nodeId: sourceId, version: actions?.find((node) => node.id === sourceId)?.version ?? 0 })), agreement: agreementIntent }
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, verificationStatus: 'unverified', agreementReviews: [], generationRequest: request })
    setSending(true); setPublishError('')
    try {
      const result = await generate(request)
      update({ generation: result })
      if (result.status !== 'succeeded' || !result.draft || !result.createAction) {
        const message = result.errorCode === 'content_unverified'
          ? '这次整理中有内容无法对应到你的报告。请检查行动、结果和想法后重新整理。'
          : result.errorCode === 'content_invalid' ? 'AI 返回的行动草稿格式不完整，请重新整理。' : 'AI 整理失败，请重新整理。'
        local.update((current) => ({ ...current, generation: result, generated: false, verificationStatus: result.errorCode === 'content_unverified' || result.errorCode === 'content_invalid' ? 'failed' : 'unverified', input: clean, messages: appendWorkspaceNotice(current.messages, message) }))
        return
      }
      const draft = result.draft
      local.update((current) => ({ ...current, generation: result, document: draft.objective, details: { title: draft.title, description: '', points: [], note: '' }, expression: { mode: hasParent ? 'inherit' : 'clear', markdown: '' }, agreementMode: 'inherit', agreementDraft: inheritedAgreement,
        agreementReviews: draft.reviews.map((review) => ({ nodeNumber: actions?.find((node) => node.id === review.sourceId)?.number ?? 0, complies: review.complies, reason: review.exceptionReason ?? '' })), messages: [...current.messages, { id: 'ai-' + result.generationId, speaker: 'ai', body: draft.reply, model: result.model }],
        generated: true, verificationStatus: 'unverified', sourcesChanged: false, imagePlacementPending: images.length > 0, contextSignature: signatureFor(mergedParentIds) }))
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败，请稍后重试。'
      const business = error instanceof BusinessRequestError && error.kind === 'business'
      const prefix = error instanceof BusinessRequestError && error.kind === 'business' && error.code === 10001 ? '' : '暂时无法更新记录：'
      const append = business ? appendWorkspaceNotice : appendWorkspaceError
      local.update((current) => ({ ...current, generationRequest: business ? undefined : current.generationRequest,
        verificationStatus: 'unverified', messages: append(current.messages, prefix + message), input: clean }))
    } finally { setSending(false) }
  }

  const placeImages = async () => {
    if (!local.ready || !generation || generation.status !== 'succeeded' || !generation.createAction || (images.length > 0 && images.some((image) => !image.alt.trim())) || placing || sending || publishing || uploading) return
    setPlacing(true)
    try {
      const result = await placeGenerationImages(generation.generationId, images.map((image) => ({ assetId: image.assetId!, alt: image.alt.trim() })), csrfToken)
      if (result.status !== 'succeeded' || !result.draft) throw new Error('图片放置没有完成，请重试')
      local.update((current) => ({
        ...current, generation: result, document: result.draft!.objective,
        details: { ...current.details, title: result.draft!.title || current.details.title }, imagePlacementPending: false, verificationStatus: 'unverified',
        messages: [...current.messages, { id: 'ai-placement-' + Date.now(), speaker: 'ai', body: result.draft!.reply, model: result.model }],
      }))
      setPublishError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片放置失败，请重试'
      local.update((current) => ({ ...current, messages: appendWorkspaceNotice(current.messages, message) }))
    } finally { setPlacing(false) }
  }
  const imageStatus = !images.length && (generation?.draft?.images?.length ?? 0) > 0 ? '图片已移除，待清除正文引用' : !images.length ? '还没有图片' : images.some((image) => !image.alt.trim()) ? '请填写图片备注' : !generation || generation.status !== 'succeeded' ? '先在对话里整理一次行动' : placing ? '正在放置图片…' : imagePlacementPending ? '图片待放置' : '图片已放入正文'

  return (
    <WorkspaceFrame title="记录行动"
      tabs={['conversation', 'objective']}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || publishing || uploading || !local.ready} onDiscard={() => { local.discard(); setPublishError('') }} />}
      help={<HelpPopover title="行动"><p>这里仅记录本次实际行动，并核对你引用的来源节点约定。整理出草稿后说“核验一下”，确认通过才能发布。发布后，表达和约定默认继承当前节点，缺少时才自动生成，之后可独立调整。</p><p>{hasParent ? '新节点默认沿用承接节点的表达与约定。' : '首次行动暂时没有可继承的表达或约定。'}合入来源只补充行动背景，不覆盖承接节点的表达和约定。</p></HelpPopover>}
      context={hasParent ? { label: sourceNodeNumber !== undefined ? `承接 #${sourceNodeNumber}` : '承接', title: contextTitle, facts: knownFacts } : undefined}
      tabActions={<div className="flex items-center gap-2">{agreementIndicator}{hasParent && actions && sourceNodeId ? <MergeActionSources actions={actions} parentId={sourceNodeId} selectedIds={mergedParentIds} reviews={agreementReviews} disabled={sending || publishing || !local.ready} onChange={changeMergedSources} compact /> : null}</div>}
      messages={messages} profileName={profileName} profile={profile} input={input} placeholder="说说这次实际做了什么"
      sending={sending} sendingLabel={directSources.length ? '正在整理行动并核对来源约定' : '正在整理行动'} fallbackAIName={generation?.model} disabled={publishing || uploading || !local.ready || !contextValid} onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      composerMode={composerMode} onComposerModeChange={setComposerMode} imageModeBadge={images.length} status={workspaceStatus}
      imageComposer={<div className="grid gap-3">
        <div className="max-h-[min(38vh,320px)] overflow-y-auto overscroll-contain pr-1">
          <DraftImages images={images} csrfToken={csrfToken} ready={local.ready} disabled={sending || publishing || placing} onChange={changeImages} onBusyChange={setUploading} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[11px] leading-4 text-muted">{imageStatus}。图片只用于放置，不会改写正文。</span>
          <button className="primary-button" type="button" onClick={placeImages} disabled={!local.ready || !generation || generation.status !== 'succeeded' || !generation.createAction || (images.length === 0 && !(generation?.draft?.images?.length)) || (images.length > 0 && images.some((image) => !image.alt.trim())) || placing || sending || publishing || uploading}>
            {placing ? '正在放置…' : !images.length ? '清除正文图片' : imagePlacementPending ? '让 AI 放置图片' : '重新放置图片'}
          </button>
        </div>
      </div>}
      action={{ title: local.value.details.title || generation?.draft?.title, markdown: document, images: actionImages, status: sourcesChanged && document ? '引用背景已更新，文档待重新整理' : undefined, empty: '在 AI 对话中描述这次行动' }}
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
      footer={viewingAction ? <div className="ml-auto flex items-center gap-3">{publishError && <p className="max-w-[320px] text-[11px] leading-4 text-coral">{publishError} <button className="text-button ml-1 text-[11px]" type="button" onClick={() => window.location.reload()}>刷新页面</button></p>}{verificationStatus === 'passed'
        ? <button className="primary-button" type="button" onClick={publish} disabled={!canPublish}>{publishing ? '发布中…' : <><Check size={15} />发布行动</>}</button>
        : <button className="primary-button" type="button" onClick={verifyDraft} disabled={!generated || !generation?.draft || sending || publishing || !contextValid || sourcesChanged}>{verificationStatus === 'failed' ? '重新核验' : '核验'}</button>}</div> : undefined} />
  )
}

function isSavedMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
