import { Check } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { ActionExpressionMessage, ActionNode } from '../../entities/action/model/types'
import type { ChatMessage } from '../../shared/model/content'
import type { UserProfile } from '../../entities/profile/model/types'
import { canEditActionExpression, getActionExpression, getActionExpressionOrigin } from '../../entities/action/lib/expressions'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { getActionSourceAgreements } from '../../entities/action/lib/references'
import { getActionAgreement } from '../../entities/action/lib/agreements'
import { useGeneration } from '../../features/action-generation/model/useGeneration'
import type { GenerateInput, GenerationRequest, GenerationView } from '../../features/action-generation/api/generation'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { useToast } from '../../shared/ui/toast/useToast'
import { WorkspaceFrame } from './WorkspaceFrame'
import { ExpressionAgreements } from './ExpressionAgreements'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { createWorkspaceView, isExpressionWorkspaceDraft, reconcileWorkspaceDraft, type ExpressionWorkspaceDraft } from './model/workspace-draft'

/** 延续已有节点的对话修改表达；行动事实和约定在此只读，不创建新行动。 */
export function ExpressionWorkspace({ node, csrfToken, draftKey, actions, profileName, profileId, profile, users = [], contextGuide, onBack, onConfirm }: {
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
}) {
  const generate = useGeneration(csrfToken)
  const expression = getActionExpression(actions, node.id)
  const context = useMemo(() => getActionExpressionContext(actions, node.id), [actions, node.id])
  // 当前事实、文档或对话变化都会让旧生成结果失效；草稿保留，但需再对话才能保存。
  const contextSignature = JSON.stringify({ context, version: node.version, guide: contextGuide, expression: expression.markdown,
    conversation: node.conversation, expressionConversation: node.expressionConversation,
    sourceAgreements: getActionSourceAgreements(actions, node.id).map((reference) => [reference.source.id, reference.agreement.markdown]),
    downstreamAgreement: getActionAgreement(actions, node.id).markdown })
  const initialMessages = node.expressionConversation?.filter(isConversationMessage) ?? []
  const local = useLocalDraft<ExpressionWorkspaceDraft>({
    draftKey: draftKey ?? getActionDraftKey(profileId, node.projectId, 'expression', node.id),
    initialValue: { messages: initialMessages, input: '', generated: false, contextSignature, view: createWorkspaceView() },
    validate: isExpressionWorkspaceDraft,
    restore: (saved) => reconcileWorkspaceDraft(saved, contextSignature),
    hasContent: (value) => Boolean(value.input || value.draftDocument !== undefined || JSON.stringify(value.messages) !== JSON.stringify(initialMessages)),
  })
  const { messages, input, draftDocument, generated, generation, generationRequest } = local.value
  const update = (patch: Partial<ExpressionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  // ?? 只对 null／undefined 回退；生成空字符串是用户清空表达的有效选择，不能回退旧正文。
  const document = draftDocument ?? expression.markdown
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const label = expression.markdown.trim() ? '修改表达' : '补充表达'
  const canEdit = canEditActionExpression(actions, node.id)
  const canSave = local.ready && canEdit && generated && Boolean(generation?.updateExpression) && local.value.contextSignature === contextSignature && !sending && !saving && document.trim() !== expression.markdown.trim()
  const originalMessages = node.conversation.filter(isConversationMessage)
  const origin = getActionExpressionOrigin(actions, node.id)
  const expressionStatus = !document.trim() ? '表达为空' : draftDocument !== undefined ? '本次对话更新'
    : origin ? `${origin.kind === 'inherited' ? '继承自' : '修改自'} 节点 #${origin.node.number}` : undefined

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || saving || !canEdit || !context) return
    const savedMessages = messages.filter(isConversationMessage)
    const next = [...savedMessages, { id: `expression-user-${Date.now()}`, speaker: 'user' as const, body: clean, authorId: profileId }]
    const requestInput: GenerateInput = { mode: 'expression', graphId: node.projectId, nodeId: node.id, expectedVersion: node.version, message: clean,
      conversationId: generation?.conversationId, mergedParentIds: [], sourceVersions: [], agreement: { mode: 'inherit' } }
    const request: GenerationRequest = !generated && generationRequest && generation?.status !== 'failed' && JSON.stringify(generationRequest.input) === JSON.stringify(requestInput)
      ? generationRequest : { key: crypto.randomUUID(), input: requestInput }
    update({ messages: next, input: '', generated: false, generationRequest: request })
    setSending(true)
    try {
      const result = await generate(request)
      update({ generation: result })
      if (result.status !== 'succeeded' || !result.draft || !result.updateExpression) throw new Error(result.status === 'pending' ? '仍在整理，请稍后重试读取结果' : '整理失败，请重新发送')
      const draft = result.draft
      if (draft.expression.mode === 'inherit') throw new Error('表达没有变化，请说明想调整的内容')
      local.update((current) => ({ ...current, generation: result, draftDocument: draft.expression.mode === 'update' ? draft.expression.markdown : '', generated: true, contextSignature,
        messages: [...current.messages, { id: 'expression-ai-' + result.generationId, speaker: 'ai', body: draft.reply }] }))
    } catch (error) {
      update({ messages: [...savedMessages, { id: `error-${Date.now()}`, speaker: 'ai', body: '暂时无法更新表达：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。') }], input: clean })
    } finally {
      setSending(false)
    }
  }

  const conversation: ActionExpressionMessage[] = [...originalMessages.map((message) => ({ ...message, authorId: node.authorId })), ...messages.map((message) => ({ ...message, authorId: message.authorId ?? node.expressionSupplement?.authorId ?? node.authorId }))]
  if (!conversation.length) conversation.push({ id: 'welcome', speaker: 'ai', body: '基于这些行动，你想表达什么？' })

  return (
    <WorkspaceFrame title={label}
      view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
      draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || saving || !local.ready} onDiscard={local.discard} />}
      help={<HelpPopover title="表达的背景">
          <p>本次对话带入当前行动、已引用的历史行动、有效表达、来源约定和原有对话。其他分支不属于已知事实。</p>
          <p>只更新当前节点的表达，行动与约定保持原样。要清空表达，可在对话中说明；确认保存后生效。</p>
        </HelpPopover>}
      context={{ label: `节点 #${node.number}`, title: node.title, facts: context?.facts.filter((fact) => fact.number !== node.number) ?? [] }}
      messages={conversation} profileName={profileName} profile={profile} users={users} defaultAuthorId={profileId}
      input={input} inputLabel="表达对话内容" placeholder="说说想保留或调整的看法" sending={sending} disabled={saving || !local.ready || !canEdit}
      onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
      action={{ markdown: node.objectiveMarkdown ?? node.markdown, images: node.images, status: '只读', empty: '暂无行动记录' }}
      expression={{ markdown: document, images: draftDocument === undefined ? expression.sourceNode?.images : [], status: expressionStatus, empty: '暂无表达' }}
      agreement={<ExpressionAgreements node={node} actions={actions} />}
      footer={<><span className="text-xs text-muted">{!canEdit ? '该节点已有后续引用，无法修改表达' : sending ? '正在整理…' : generated ? document.trim() === expression.markdown.trim() ? '表达未变化' : '待保存' : draftDocument !== undefined ? '本轮未完成' : '尚未生成'}</span>
        <button className="primary-button" type="button" disabled={!canSave} onClick={async () => {
              if (!canSave) return
              setSaving(true)
              try {
                if (!generation?.updateExpression || !await onConfirm(generation.updateExpression)) { showToast({ kind: 'error', message: '节点状态已变化，无法保存表达' }); return }
                local.remove()
                showToast({ kind: 'info', message: document.trim() ? `已${label}` : '已清空表达' })
              } catch (error) { showToast({ kind: 'error', message: error instanceof Error ? error.message : '保存失败，请重试' }) }
              finally { setSaving(false) }
        }}><Check size={15} />保存表达</button></>} />
  )
}

function isConversationMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
