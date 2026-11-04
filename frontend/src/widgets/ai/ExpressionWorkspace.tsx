import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { ActionExpressionMessage, ActionNode } from '../../entities/action/model/types'
import type { ChatMessage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { canEditActionExpression } from '../../entities/action/lib/expressions'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { getActionSourceAgreements } from '../../entities/action/lib/references'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import { getNodeDocuments } from '../../features/action-generation/api/generation'
import type { GenerateInput, GenerationRequest, GenerationView } from '../../features/action-generation/api/generation'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { useToast } from '../../shared/ui/toast/useToast'
import { WorkspaceFrame } from './WorkspaceFrame'
import { ExpressionAgreements } from './ExpressionAgreements'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { appendWorkspaceError, appendWorkspaceNotice, createWorkspaceView, isExpressionWorkspaceDraft, normalizeGenerationRequest, reconcileWorkspaceDraft, type ExpressionWorkspaceDraft } from './model/workspace-draft'
import { BusinessRequestError } from '../../shared/api/errors'

/** 使用独立对话修改表达；行动事实和约定在此只读，不创建新行动。 */
export function ExpressionWorkspace({ node, csrfToken, draftKey, actions, profileName, profileId, profile, users = [], contextGuide, onBack, onConfirm, onPublishDraft }: {
  node: ActionNode & { version: number }
  csrfToken: string
  draftKey?: string
  actions: ActionNode[]
  profileName: string
  profileId: string
  profile?: UserProfile
  users?: UserProfile[]
  contextGuide?: string
  onBack: () => void
  onConfirm: (input: NonNullable<GenerationView['updateExpression']>) => boolean | Promise<boolean>
  onPublishDraft?: () => Promise<boolean>
}) {
  const generate = useGeneration(csrfToken)
  const [initialDraft, setInitialDraft] = useState('')
  useEffect(() => {
    if (node.authorId !== profileId) return
    let active = true
    void getNodeDocuments(node.id).then((documents) => {
      const document = documents.find((item) => item.kind === 'expression')
      const draft = document?.status === 'draft' ? document.draftMarkdown?.trim() : undefined
      if (active && draft) setInitialDraft(draft)
    }).catch(() => undefined)
    return () => { active = false }
  }, [node.id, node.authorId, profileId])
  const expression = { markdown: initialDraft || node.expressionMarkdown || '' }
  const context = useMemo(() => getActionExpressionContext(actions, node.id), [actions, node.id])
  // 当前事实、文档或对话变化都会让旧生成结果失效；草稿保留，但需再对话才能保存。
  const contextSignature = JSON.stringify({ context, version: node.version, guide: contextGuide, expression: node.expressionMarkdown ?? '',
    sourceAgreements: getActionSourceAgreements(actions, node.id).map((reference) => [reference.source.id, reference.agreement.markdown]),
    downstreamAgreement: node.agreementMarkdown ?? '' })
  const initialMessages: ActionExpressionMessage[] = node.expressionConversation ?? []
  const local = useLocalDraft<ExpressionWorkspaceDraft>({
    draftKey: draftKey ?? getActionDraftKey(profileId, node.projectId, 'expression', node.id),
    initialValue: { messages: initialMessages, input: '', generated: false, contextSignature, view: createWorkspaceView() },
    validate: isExpressionWorkspaceDraft,
    restore: (saved) => reconcileWorkspaceDraft({ ...saved, generationRequest: normalizeGenerationRequest(saved.generationRequest) }, contextSignature),
    hasContent: (value) => Boolean(value.input || value.draftDocument !== undefined || JSON.stringify(value.messages) !== JSON.stringify(initialMessages)),
  })
  const { messages, input, draftDocument, generated, generation, generationRequest } = local.value
  const update = (patch: Partial<ExpressionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  // ?? 只对 null／undefined 回退；生成空字符串是用户清空表达的有效选择，不能回退旧正文。
  const document = draftDocument ?? expression.markdown
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const canEdit = canEditActionExpression(actions, node.id)
  const canPublishExistingDraft = local.ready && canEdit && Boolean(initialDraft) && Boolean(onPublishDraft) && !sending && !saving && document.trim() === expression.markdown.trim()
  const canSave = canPublishExistingDraft || (local.ready && canEdit && generated && Boolean(generation?.updateExpression) && local.value.contextSignature === contextSignature && !sending && !saving && document.trim() !== expression.markdown.trim())
  const expressionStatus = !document.trim() ? '尚未发布表达' : draftDocument !== undefined ? '本次对话更新' : undefined
  const workspaceStatus: { text: string; tone: 'muted' | 'signal' | 'warning' | 'coral' } = !canEdit ? { text: '不可修改', tone: 'coral' }
    : sending ? { text: '正在整理…', tone: 'muted' }
      : saving ? { text: '正在保存…', tone: 'muted' }
        : !document.trim() ? { text: '尚未生成', tone: 'muted' }
          : canPublishExistingDraft ? { text: '待发布', tone: 'signal' }
            : generated ? { text: '草稿已生成', tone: 'muted' }
              : draftDocument !== undefined ? { text: '本轮未完成', tone: 'coral' }
                : initialDraft ? { text: '待发布', tone: 'signal' }
                  : { text: '已发布', tone: 'muted' }

  const viewingDocument = local.value.view.tab === 'expression'
  const applyGeneration = (result: GenerationView) => {
    update({ generation: result })
    if (result.status !== 'succeeded' || !result.draft || !result.updateExpression) throw new Error(result.status === 'pending' ? '仍在整理，请稍后重试读取结果' : '整理失败，请重新发送')
    const draft = result.draft
    if (draft.expression.mode === 'inherit') throw new Error('表达没有变化，请说明想调整的内容')
    local.update((current) => ({ ...current, generation: result, draftDocument: draft.expression.mode === 'update' ? draft.expression.markdown : '', generated: true, contextSignature,
      messages: [...current.messages, { id: 'expression-ai-' + result.generationId, speaker: 'ai', body: draft.reply, model: result.model }] }))
  }
  const applyGenerationRef = useRef(applyGeneration)
  applyGenerationRef.current = applyGeneration
  const generateRef = useRef(generate)
  const updateRef = useRef(local.update)
  generateRef.current = generate
  updateRef.current = local.update
  const resumedRequest = useRef<string | undefined>(undefined)
  // 离开页面会中止浏览器请求，但服务端继续处理；回到草稿时用同一幂等键恢复结果。
  useEffect(() => {
    if (!local.ready || generated || sending || saving || !generationRequest || !canEdit) return
    if (generation?.status === 'succeeded' || generation?.status === 'failed' || resumedRequest.current === generationRequest.key) return
    resumedRequest.current = generationRequest.key
    setSending(true)
    void generateRef.current(generationRequest).then((result) => { applyGenerationRef.current(result) }).catch((error) => {
      const business = error instanceof BusinessRequestError && error.kind === 'business'
      const append = business ? appendWorkspaceNotice : appendWorkspaceError
      updateRef.current((current) => ({ ...current, generationRequest: business ? undefined : current.generationRequest, messages: append(current.messages, '暂时无法更新表达：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。')) }))
    }).finally(() => { setSending(false) })
  }, [canEdit, generated, generation?.status, generationRequest, local.ready, saving, sending])
  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || saving || !canEdit || !context) return
    const savedMessages = messages.filter(isConversationMessage)
    const next = [...savedMessages, { id: `expression-user-${Date.now()}`, speaker: 'user' as const, body: clean, authorId: profileId }]
    const requestInput: GenerateInput = { mode: 'expression', graphId: node.projectId, nodeId: node.id, expectedVersion: node.version, messages: [clean],
      conversationId: generation?.conversationId, mergedParentIds: [], sourceVersions: [], agreement: { mode: 'inherit' }, currentDocument: document }
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, generationRequest: request })
    setSending(true)
    try {
      applyGeneration(await generate(request))
    } catch (error) {
      const business = error instanceof BusinessRequestError && error.kind === 'business'
      const append = business ? appendWorkspaceNotice : appendWorkspaceError
      local.update((current) => ({ ...current, messages: append(current.messages, '暂时无法更新表达：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。')), input: clean }))
    } finally {
      setSending(false)
    }
  }

  const conversation: ActionExpressionMessage[] = messages.map((message) => ({ ...message, authorId: message.authorId ?? profileId }))
  if (!conversation.length) conversation.push({ id: 'welcome', speaker: 'ai', body: '基于这些行动，你想让别人看到你对什么感兴趣、持什么态度？' })

  return (
    <WorkspaceFrame title="梳理表达"
      tabs={['conversation', 'expression']}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || saving || !local.ready} onDiscard={local.discard} />}
      help={<HelpPopover title="表达的背景">
          <p>本次对话带入整条支链的行动事实、有效表达与来源约定。其他分支不属于已知事实，行动对话也与本对话分开保存。</p>
          <p>只更新当前节点的表达，行动与约定保持原样。表达面向其他用户，写兴趣、态度和有依据的判断，不必按时间复述行动。要清空表达，可在对话中说明；确认保存后生效。</p>
        </HelpPopover>}
      context={{ label: `节点 #${node.number}`, title: node.title, facts: context?.facts.filter((fact) => fact.number !== node.number) ?? [] }}
      messages={conversation} profileName={profileName} profile={profile} users={users} defaultAuthorId={profileId} status={workspaceStatus}
      input={input} inputLabel="表达对话内容" placeholder="说说想保留或调整的看法" sending={sending} fallbackAIName={generation?.model} disabled={saving || !local.ready || !canEdit}
      onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      action={{ title: node.title, markdown: node.objectiveMarkdown ?? node.markdown, images: node.images, status: '只读', empty: '暂无行动记录' }}
      expression={{ markdown: document, images: [], status: expressionStatus, empty: '暂无表达' }}
      agreement={<ExpressionAgreements node={node} actions={actions} />}
      footer={viewingDocument ? <div className="ml-auto">
        <button className="primary-button" type="button" disabled={!canSave} onClick={async () => {
              if (!canSave) return
              setSaving(true)
              try {
                if (canPublishExistingDraft) {
                  if (!onPublishDraft || !await onPublishDraft()) { showToast({ kind: 'error', message: '节点状态已变化，无法发布表达' }); return }
                  local.remove()
                  return
                }
                if (!generation?.updateExpression || !await onConfirm(generation.updateExpression)) { showToast({ kind: 'error', message: '节点状态已变化，无法发布表达' }); return }
                local.remove()
              } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '发布失败，请重试' }) }
              finally { setSaving(false) }
        }}><Check size={15} />{saving ? '发布中…' : '发布表达'}</button>
      </div> : undefined} />
  )
}

function isConversationMessage(message: ChatMessage): boolean { return message.id !== 'welcome' && !message.id.startsWith('error-') }
