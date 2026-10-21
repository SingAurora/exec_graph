import { Check } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { ActionExpressionMessage, ActionNode } from '../../entities/action/model/types'
import type { AIKeyConfig } from '../../entities/ai-key/model/types'
import type { ChatMessage, UserProfile } from '../../shared/model'
import { canEditActionExpression, getActionExpression, getActionExpressionOrigin } from '../../entities/action/lib/expressions'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { getActionSourceAgreements } from '../../entities/action/lib/references'
import { getActionAgreement } from '../../entities/action/lib/agreements'
import { generateAIDocument, type AIConversationTurn } from '../../features/ai-key/api/chat'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import { useToast } from '../../shared/ui/toast/useToast'
import { WorkspaceFrame } from './WorkspaceFrame'
import { ExpressionAgreements } from './ExpressionAgreements'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { useLocalDraft } from '../../shared/lib/local-draft/useLocalDraft'
import { LocalDraftControls } from '../../shared/ui/LocalDraftControls'
import { createWorkspaceView, isExpressionWorkspaceDraft, reconcileWorkspaceDraft, type ExpressionWorkspaceDraft } from './model/workspace-draft'

/** Continues the node's dialogue to revise its expression against its existing factual background. */
export function ExpressionWorkspace({ node, actions, profileName, profileId, profile, users = [], aiConfig, contextGuide, onBack, onConfirm }: {
  node: ActionNode
  actions: ActionNode[]
  profileName: string
  profileId: string
  profile?: UserProfile
  users?: UserProfile[]
  aiConfig?: AIKeyConfig
  contextGuide?: string
  onBack: () => void
  onConfirm: (markdown: string, conversation: ChatMessage[]) => boolean
}) {
  const expression = getActionExpression(actions, node.id)
  const context = useMemo(() => getActionExpressionContext(actions, node.id), [actions, node.id])
  const contextSignature = JSON.stringify({ context, guide: contextGuide, expression: expression.markdown,
    conversation: node.conversation, expressionConversation: node.expressionConversation,
    sourceAgreements: getActionSourceAgreements(actions, node.id).map((reference) => [reference.source.id, reference.agreement.markdown]),
    downstreamAgreement: getActionAgreement(actions, node.id).markdown })
  const initialMessages = node.expressionConversation?.filter(isConversationMessage) ?? []
  const local = useLocalDraft<ExpressionWorkspaceDraft>({
    draftKey: getActionDraftKey(profileId, node.projectId, 'expression', node.id),
    initialValue: { messages: initialMessages, input: '', generated: false, contextSignature, view: createWorkspaceView() },
    validate: isExpressionWorkspaceDraft,
    restore: (saved) => reconcileWorkspaceDraft(saved, contextSignature),
    hasContent: (value) => Boolean(value.input || value.draftDocument !== undefined || JSON.stringify(value.messages) !== JSON.stringify(initialMessages)),
  })
  const { messages, input, draftDocument, generated } = local.value
  const update = (patch: Partial<ExpressionWorkspaceDraft>) => local.update((current) => ({ ...current, ...patch }))
  const document = draftDocument ?? expression.markdown
  const [sending, setSending] = useState(false)
  const { showToast } = useToast()
  const label = expression.markdown.trim() ? '修改表达' : '补充表达'
  const canEdit = canEditActionExpression(actions, node.id)
  const canSave = local.ready && canEdit && generated && local.value.contextSignature === contextSignature && !sending && document.trim() !== expression.markdown.trim()
  const originalMessages = node.conversation.filter(isConversationMessage)
  const origin = getActionExpressionOrigin(actions, node.id)
  const expressionStatus = !document.trim() ? '表达为空' : draftDocument !== undefined ? '本次对话更新'
    : origin ? `${origin.kind === 'inherited' ? '继承自' : '修改自'} 节点 #${origin.node.number}` : undefined

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const clean = input.trim()
    if (!local.ready || !clean || sending || !canEdit || !context) return
    const savedMessages = messages.filter(isConversationMessage)
    const next = [...savedMessages, { id: `expression-user-${Date.now()}`, speaker: 'user' as const, body: clean, authorId: profileId }]
    update({ messages: next, input: '', generated: false })
    setSending(true)
    try {
      if (!aiConfig) throw new Error('还没有可用的 AI 配置，请先前往设置。')
      const turns: AIConversationTurn[] = [...originalMessages, ...next].filter(isConversationMessage)
        .map((message) => ({ role: message.speaker === 'ai' ? 'assistant' : 'user', content: message.body }))
      const result = await generateAIDocument({
        config: aiConfig, mode: 'expression', turns, currentDocument: document, expressionContext: context, contextGuide,
        sourceAgreements: getActionSourceAgreements(actions, node.id).map((reference) => ({ nodeNumber: reference.source.number, markdown: reference.agreement.markdown })),
        downstreamAgreement: getActionAgreement(actions, node.id).markdown,
      })
      local.update((current) => ({ ...current, draftDocument: result.document, generated: true, contextSignature,
        messages: [...current.messages, { id: `expression-ai-${Date.now()}`, speaker: 'ai', body: result.reply }] }))
    } catch (error) {
      update({ messages: [...savedMessages, { id: `error-${Date.now()}`, speaker: 'ai', body: '暂时无法更新表达：' + (error instanceof Error ? error.message : '请求失败，请稍后重试。') }], input: clean })
    } finally {
      setSending(false)
    }
  }

  const conversation: ActionExpressionMessage[] = [...originalMessages.map((message) => ({ ...message, authorId: node.authorId })), ...messages.map((message) => ({ ...message, authorId: message.authorId ?? node.expressionSupplement?.authorId ?? node.authorId }))]
  if (!conversation.length) conversation.push({ id: 'welcome', speaker: 'ai', body: '基于这些行动，你想表达什么？' })

  return <WorkspaceFrame title={label} tabLabel="表达工作区"
    view={local.value.view} onViewChange={(view) => update({ view })} restoring={!local.ready}
    draftControls={<LocalDraftControls status={local.status} hasDraft={local.hasDraft} disabled={sending || !local.ready} onDiscard={local.discard} />}
    help={<HelpPopover title="表达的背景">
        <p>本次对话带入当前行动、已引用的历史行动、有效表达、来源约定和原有对话。其他分支不属于已知事实。</p>
        <p>只更新当前节点的表达，行动与约定保持原样。要清空表达，可在对话中说明；确认保存后生效。</p>
      </HelpPopover>}
    context={{ label: `节点 #${node.number}`, title: node.title, facts: context?.facts.filter((fact) => fact.number !== node.number) ?? [] }}
    messages={conversation} profileName={profileName} profile={profile} users={users} defaultAuthorId={profileId}
    input={input} inputLabel="表达对话内容" placeholder="说说想保留或调整的看法" sending={sending} disabled={!local.ready || !canEdit}
    onInputChange={(input) => update({ input })} onSend={send} onBack={onBack}
    action={{ markdown: node.objectiveMarkdown ?? node.markdown, images: node.images, status: '只读', empty: '暂无行动记录' }}
    expression={{ markdown: document, images: draftDocument === undefined ? expression.sourceNode?.images : [], status: expressionStatus, empty: '暂无表达' }}
    agreement={<ExpressionAgreements node={node} actions={actions} />}
    footer={<><span className="text-xs text-muted" role="status">{!canEdit ? '该节点已有后续引用，无法修改表达' : sending ? '正在整理…' : generated ? document.trim() === expression.markdown.trim() ? '表达未变化' : '待保存' : draftDocument !== undefined ? '本轮未完成' : '尚未生成'}</span>
      <button className="primary-button" type="button" disabled={!canSave} onClick={() => {
            if (!canSave) return
            if (!onConfirm(document, messages.filter(isConversationMessage))) { showToast({ kind: 'error', message: '节点状态已变化，无法保存表达' }); return }
            local.remove()
            showToast({ kind: 'info', message: document.trim() ? `已${label}` : '已清空表达' })
      }}><Check size={15} />保存表达</button></>} />
}

function isConversationMessage(message: ChatMessage): boolean {
  return message.id !== 'welcome' && !message.id.startsWith('error-')
}
