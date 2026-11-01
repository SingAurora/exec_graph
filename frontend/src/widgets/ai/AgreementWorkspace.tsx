import { Check } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { ActionExpressionMessage, ActionNode } from '../../entities/action/model/types'
import type { ChatMessage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { canEditActionAgreement, getActionAgreement, getActionAgreementOrigin } from '../../entities/action/lib/agreements'
import { getActionExpression } from '../../entities/action/lib/expressions'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { documentUpdate } from '../../features/action/api/commands'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import type { GenerateInput, GenerationRequest, GenerationView } from '../../features/action-generation/api/generation'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { useToast } from '../../shared/ui/toast/useToast'
import { WorkspaceFrame } from './WorkspaceFrame'
import { AgreementContent } from '../../entities/action/ui/AgreementContent'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { appendWorkspaceError, appendWorkspaceNotice, createWorkspaceView, isExpressionWorkspaceDraft, normalizeGenerationRequest, reconcileWorkspaceDraft, type ExpressionWorkspaceDraft } from './model/workspace-draft'
import { BusinessRequestError } from '../../shared/api/errors'

/** 独立整理本节点向后传递的约定，不改写行动、表达或已有来源核对。 */
export function AgreementWorkspace({ node, csrfToken, draftKey, actions, profileName, profileId, profile, users = [], contextGuide, onBack, onConfirm }: {
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
  onConfirm: (input: NonNullable<GenerationView['updateAgreement']>) => boolean | Promise<boolean>
}) {
  const generate = useGeneration(csrfToken)
  const agreement = getActionAgreement(actions, node.id)
  const expression = getActionExpression(actions, node.id)
  const expressionContext = useMemo(() => getActionExpressionContext(actions, node.id), [actions, node.id])
  const signature = JSON.stringify({ node: node.id, version: node.version, guide: contextGuide, agreement: agreement.markdown,
    origin: getActionAgreementOrigin(actions, node.id)?.node.id, facts: expressionContext?.facts })
  const local = useLocalDraft<ExpressionWorkspaceDraft>({
    draftKey: draftKey ?? getActionDraftKey(profileId, node.projectId, 'agreement', node.id),
    initialValue: { messages: node.agreementConversation ?? [], input: '', generated: false, contextSignature: signature, view: createWorkspaceView() },
    validate: isExpressionWorkspaceDraft,
    restore: (saved) => reconcileWorkspaceDraft({ ...saved, generationRequest: normalizeGenerationRequest(saved.generationRequest) }, signature),
    hasContent: (value) => Boolean(value.input || value.draftDocument !== undefined || value.messages.length),
  })
  const { messages, input, draftDocument, generated, generation, generationRequest } = local.value
  const update = (patch: Partial<ExpressionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const markdown = draftDocument ?? agreement.markdown
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const canEdit = canEditActionAgreement(actions, node.id)
  const canSave = local.ready && canEdit && generated && Boolean(generation?.updateAgreement)
    && local.value.contextSignature === signature && !sending && !saving && markdown.trim() !== agreement.markdown.trim()
  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || saving || !canEdit) return
    const next = [...messages.filter(isConversationMessage), { id: `agreement-user-${Date.now()}`, speaker: 'user' as const, body: clean, authorId: profileId }]
    const requestInput: GenerateInput = { mode: 'agreement', graphId: node.projectId, nodeId: node.id, expectedVersion: node.version, messages: [clean],
      conversationId: generation?.conversationId, mergedParentIds: [], sourceVersions: [], agreement: documentUpdate(agreement.markdown) }
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, generationRequest: request })
    setSending(true)
    try {
      const result = await generate(request)
      update({ generation: result })
      if (result.status !== 'succeeded' || !result.draft || !result.updateAgreement) throw new Error(result.status === 'pending' ? '仍在整理，请稍后重试读取结果' : '整理失败，请重新发送')
      const draft = result.draft.agreement
      if (!draft) throw new Error('AI 没有返回约定草稿，请重新发送。')
      if (draft.mode === 'inherit') throw new Error('约定没有变化，请说明要补充或调整的内容')
      local.update((current) => ({ ...current, generation: result, draftDocument: draft.mode === 'update' ? draft.markdown : '', generated: true, contextSignature: signature,
        messages: [...current.messages, { id: `agreement-ai-${result.generationId}`, speaker: 'ai', body: result.draft!.reply, model: result.model }] }))
    } catch (error) {
      const business = error instanceof BusinessRequestError && error.kind === 'business'
      const append = business ? appendWorkspaceNotice : appendWorkspaceError
      local.update((current) => ({ ...current, messages: append(current.messages, `暂时无法更新约定：${error instanceof Error ? error.message : '请求失败，请稍后重试。'}`), input: clean }))
    } finally { setSending(false) }
  }
  const conversation: ActionExpressionMessage[] = messages.map((message) => ({ ...message, authorId: message.authorId ?? profileId }))
  if (!conversation.length) conversation.push({ id: 'welcome', speaker: 'ai', body: '你希望后来引用这个节点的人满足什么条件？可以说得具体一些，也可以先讨论再决定。' })
  const context = expressionContext

  return (
    <WorkspaceFrame title={agreement.markdown.trim() ? '修改约定' : '补充约定'}
      tabs={['conversation', 'objective', 'agreement']}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || saving || !local.ready} onDiscard={local.discard} />}
      help={<HelpPopover title="约定的作用"><p>约定说明后来引用这个节点时，你希望对方满足什么条件。它不同于本次行动是否满足来源节点的约定。</p><p>约定从当前节点向后生效；保存后不会改写已有引用的核对结果。</p></HelpPopover>}
      context={{ label: `节点 #${node.number}`, title: node.title, facts: context?.facts.filter((fact) => fact.number !== node.number) ?? [] }}
      messages={conversation} profileName={profileName} profile={profile} users={users} defaultAuthorId={profileId}
      input={input} inputLabel="约定对话内容" placeholder="说说你希望对方满足什么条件" sending={sending} fallbackAIName={generation?.model} disabled={saving || !local.ready || !canEdit}
      onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      action={{ title: node.title, markdown: node.objectiveMarkdown ?? node.markdown, images: node.images, status: '只读', empty: '暂无行动记录' }}
      expression={{ markdown: expression.markdown, images: expression.sourceNode?.images, status: '只读', empty: '暂无表达' }}
      agreement={<AgreementContent agreement={{ markdown: agreement.markdown, sourceNode: getActionAgreementOrigin(actions, node.id)?.node }} onSelectSource={() => {}} />}
      footer={<><span className="text-xs text-muted">{!canEdit ? '该节点已有后续引用，无法修改约定' : sending ? '正在整理…' : generated ? markdown.trim() === agreement.markdown.trim() ? '约定未变化' : '待保存' : draftDocument !== undefined ? '本轮未完成' : '尚未生成'}</span>
        <button className="primary-button" type="button" disabled={!canSave} onClick={async () => {
          if (!canSave) return
          setSaving(true)
          try {
            if (!generation?.updateAgreement || !await onConfirm(generation.updateAgreement)) { showToast({ kind: 'error', message: '节点状态已变化，无法保存约定' }); return }
            local.remove()
          } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '保存失败，请重试' }) }
          finally { setSaving(false) }
        }}><Check size={15} />保存约定</button></>} />
  )
}

function isConversationMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
