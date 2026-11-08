import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react'
import type { ActionExpressionMessage, ActionNode } from '../../entities/action/model/types'
import type { ChatMessage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { canEditActionAgreement } from '../../entities/action/lib/agreements'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { documentUpdate } from '../../features/action/api/commands'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import { getNodeDocuments } from '../../features/action-generation/api/generation'
import type { GenerateInput, GenerationRequest, GenerationView } from '../../features/action-generation/api/generation'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { useToast } from '../../shared/ui/toast/useToast'
import { WorkspaceFrame } from './WorkspaceFrame'
import { DefaultEffectGuide } from './DefaultEffectGuide'
import { AgreementContent } from '../../entities/action/ui/AgreementContent'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { appendWorkspaceError, appendWorkspaceNotice, createWorkspaceView, isExpressionWorkspaceDraft, normalizeGenerationRequest, reconcileWorkspaceDraft, type ExpressionWorkspaceDraft } from './model/workspace-draft'
import { BusinessRequestError } from '../../shared/api/errors'

/** 独立整理本节点向后传递的约定，不改写行动、表达或已有来源核对。 */
export function AgreementWorkspace({ node, draftKey, actions, profileName, profileUuid, profile, users = [], contextGuide, onBack, onConfirm, onPublishDraft }: {
  node: ActionNode & { version: number }
  draftKey?: string
  actions: ActionNode[]
  profileName: string
  profileUuid: string
  profile?: UserProfile
  users?: UserProfile[]
  contextGuide?: string
  onBack: () => void
  onConfirm: (input: NonNullable<GenerationView['updateAgreement']>) => boolean | Promise<boolean>
  onPublishDraft?: () => Promise<boolean>
}) {
  const { generate } = useGeneration()
  const [initialDraft, setInitialDraft] = useState('')
  useEffect(() => {
    if (node.authorUuid !== profileUuid) return
    let active = true
    void getNodeDocuments(node.uuid).then((documents) => {
      const document = documents.find((item) => item.kind === 'agreement')
      const draft = document?.status === 'draft' ? document.draftMarkdown?.trim() : undefined
      if (active && draft) setInitialDraft(draft)
    }).catch(() => undefined)
    return () => { active = false }
  }, [node.uuid, node.authorUuid, profileUuid])
  const agreement = { markdown: initialDraft || node.agreementMarkdown || '' }
  const expressionContext = useMemo(() => getActionExpressionContext(actions, node.uuid), [actions, node.uuid])
  const signature = JSON.stringify({ node: node.uuid, version: node.version, guide: contextGuide, agreement: node.agreementMarkdown ?? '',
    facts: expressionContext?.facts })
  const local = useLocalDraft<ExpressionWorkspaceDraft>({
    draftKey: draftKey ?? getActionDraftKey(profileUuid, node.graphUuid, 'agreement', node.uuid),
    initialValue: { messages: node.agreementConversation ?? [], input: '', generated: false, contextSignature: signature, view: createWorkspaceView() },
    validate: isExpressionWorkspaceDraft,
    restore: (saved) => reconcileWorkspaceDraft({ ...saved, generationRequest: normalizeGenerationRequest(saved.generationRequest) }, signature),
    hasContent: (value) => Boolean(value.input || value.draftDocument !== undefined || value.messages.length),
  })
  const { messages, input, draftDocument, generated, generation, generationRequest } = local.value
  const update = (patch: Partial<ExpressionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const fillPhrase = (phrase: string) => update({ input: phrase, view: { ...local.value.view, tab: 'conversation' } })
  const markdown = draftDocument ?? agreement.markdown
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const canEdit = canEditActionAgreement(actions, node.uuid)
  const canPublishExistingDraft = local.ready && canEdit && Boolean(initialDraft) && Boolean(onPublishDraft) && !sending && !saving && markdown.trim() === agreement.markdown.trim()
  const canSave = canPublishExistingDraft || (local.ready && canEdit && generated && Boolean(generation?.updateAgreement)
    && local.value.contextSignature === signature && !sending && !saving && markdown.trim() !== agreement.markdown.trim())
  const viewingDocument = local.value.view.tab === 'agreement'
  const applyGeneration = (result: GenerationView) => {
    update({ generation: result })
    if (result.status !== 'succeeded' || !result.draft || !result.updateAgreement) throw new Error(result.status === 'pending' ? '仍在整理，请稍后重试读取结果' : '整理失败，请重新发送')
    const draft = result.draft.agreement
    if (!draft) throw new Error('AI 没有返回约定草稿，请重新发送。')
    if (draft.mode === 'inherit') throw new Error('约定没有变化，请说明要补充或调整的内容')
    local.update((current) => ({ ...current, generation: result, draftDocument: draft.mode === 'update' ? draft.markdown : '', generated: true, contextSignature: signature,
      messages: [...current.messages, { id: `agreement-ai-${result.generationUuid}`, speaker: 'ai', body: result.draft!.reply, model: result.model }] }))
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
      updateRef.current((current) => ({ ...current, generationRequest: business ? undefined : current.generationRequest, messages: append(current.messages, `暂时无法更新约定：${error instanceof Error ? error.message : '请求失败，请稍后重试。'}`) }))
    }).finally(() => { setSending(false) })
  }, [canEdit, generated, generation?.status, generationRequest, local.ready, saving, sending])
  const send = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || saving || !canEdit) return
    const next = [...messages.filter(isConversationMessage), { id: `agreement-user-${Date.now()}`, speaker: 'user' as const, body: clean, authorUuid: profileUuid }]
    const requestInput: GenerateInput = { mode: 'agreement', graphUuid: node.graphUuid, nodeUuid: node.uuid, expectedVersion: node.version, messages: [clean],
      conversationUuid: generation?.conversationUuid, mergedParentUuids: [], sourceVersions: [], agreement: documentUpdate(node.agreementMarkdown ?? ''), currentDocument: markdown }
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, generationRequest: request })
    setSending(true)
    try {
      applyGeneration(await generate(request))
    } catch (error) {
      const business = error instanceof BusinessRequestError && error.kind === 'business'
      const append = business ? appendWorkspaceNotice : appendWorkspaceError
      local.update((current) => ({ ...current, messages: append(current.messages, `暂时无法更新约定：${error instanceof Error ? error.message : '请求失败，请稍后重试。'}`), input: clean }))
    } finally { setSending(false) }
  }
  const conversation: ActionExpressionMessage[] = messages.map((message) => ({ ...message, authorUuid: message.authorUuid ?? profileUuid }))
  const context = expressionContext
  const workspaceStatus: { text: string; tone: 'muted' | 'signal' | 'warning' | 'coral' } = !canEdit ? { text: '不可修改', tone: 'coral' }
    : sending ? { text: '正在整理…', tone: 'muted' }
      : saving ? { text: '正在保存…', tone: 'muted' }
        : !markdown.trim() ? { text: '尚未生成', tone: 'muted' }
          : canPublishExistingDraft ? { text: '待发布', tone: 'signal' }
            : generated ? { text: '草稿已生成', tone: 'muted' }
              : draftDocument !== undefined ? { text: '本轮未完成', tone: 'coral' }
                : initialDraft ? { text: '待发布', tone: 'signal' }
                  : { text: '已发布', tone: 'muted' }

  return (
    <WorkspaceFrame title="拟定约定"
      tabs={['conversation', 'agreement', 'guide']}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || saving || !local.ready} onDiscard={local.discard} />}
      help={<HelpPopover title="约定的作用"><p>约定说明后来引用这个节点时，你希望对方满足什么条件。它参考整条支链的事实与表达，但不同于本次行动是否满足来源节点的约定。</p><p>约定从当前节点向后生效；保存后不会改写已有引用的核对结果。</p><p>想要低负担默认稿时，直接说“给我一个默认效果的约定”。</p></HelpPopover>}
      context={{ label: `节点 #${node.number}`, title: node.title, facts: context?.facts.filter((fact) => fact.number !== node.number) ?? [] }}
      starterHint="你希望后来引用这个节点的人满足什么条件？可以说得具体一些，也可以先讨论再决定。" messages={conversation.filter((message) => message.id !== 'welcome')} profileName={profileName} profile={profile} users={users} defaultAuthorUuid={profileUuid} status={workspaceStatus}
      input={input} inputLabel="约定对话内容" placeholder="说说你希望对方满足什么条件，或“给我一个默认效果的约定”" sending={sending} fallbackAIName={generation?.model} disabled={saving || !local.ready || !canEdit}
      onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      action={{ title: node.title, markdown: node.objectiveMarkdown ?? node.markdown, images: node.images, status: '只读', empty: '暂无行动记录' }}
      expression={{ markdown: node.expressionMarkdown ?? '', images: [], status: '只读', empty: '暂无表达' }}
      agreement={<div className="px-6"><AgreementContent agreement={{ markdown }} onSelectSource={() => {}} /></div>}
      guide={<DefaultEffectGuide workspace="agreement" onUse={fillPhrase} />}
      footer={viewingDocument ? <div className="ml-auto">
        <button className="primary-button" type="button" disabled={!canSave} onClick={async () => {
          if (!canSave) return
          setSaving(true)
          try {
            if (canPublishExistingDraft) {
              if (!onPublishDraft || !await onPublishDraft()) { showToast({ kind: 'error', message: '节点状态已变化，无法发布约定' }); return }
              local.remove()
              return
            }
            if (!generation?.updateAgreement || !await onConfirm(generation.updateAgreement)) { showToast({ kind: 'error', message: '节点状态已变化，无法发布约定' }); return }
            local.remove()
          } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '发布失败，请重试' }) }
          finally { setSaving(false) }
        }}><Check size={15} />{saving ? '发布中…' : '发布约定'}</button>
      </div> : undefined} />
  )
}

function isConversationMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
