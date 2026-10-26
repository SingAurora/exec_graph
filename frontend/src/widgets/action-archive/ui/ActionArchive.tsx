import { ArrowLeft, ChevronDown, FileText, Footprints, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { getActionExpression, getActionExpressionOrigin } from '../../../entities/action/lib/expressions'
import { getActionExpressionChange } from '../../../entities/action/lib/formation'
import { getDocumentRevisionLabel } from '../../../entities/action/lib/document-revision'
import { getActionLevels } from '../../../entities/action/lib/levels'
import { ExpressionContent } from '../../../entities/action/ui/ExpressionContent'
import type { Project } from '../../../entities/project/model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { formatFullPublicationTime, formatPublicationTime } from '../../../shared/lib/date'
import { Avatar } from '../../../shared/ui/Avatar'
import { ProfilePreview } from '../../../entities/profile/ui/ProfilePreview'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { ArchiveBackground } from './ArchiveBackground'
import { getActionAgreement, getActionAgreementOrigin } from '../../../entities/action/lib/agreements'
import { AgreementContent } from '../../../entities/action/ui/AgreementContent'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ArchiveConversation } from './ArchiveConversation'

/** 形成过程：先追溯引用与约定，再连续展示原始及追加对话，最后阅读行动／表达结果。 */
export function ActionArchive({ project, node, actions, users, onBack, onSelectSource }: {
  project: Project
  node: ActionNode
  actions: ActionNode[]
  users: UserProfile[]
  onBack: () => void
  onSelectSource: (id: string) => void
}) {
  const author = users.find((user) => user.id === node.authorId)
  const authorName = author?.name ?? node.authorId
  const expression = getActionExpression(actions, node.id)
  const agreement = getActionAgreement(actions, node.id)
  const change = getActionExpressionChange(actions, node.id)
  const expressionSource = change.source
  const changeLabels = { initial: '首次填写表达', modified: '修改自', inherited: '继承自', cleared: '已主动清空表达', empty: '未填写表达' }
  const supplement = node.expressionSupplement
  const supplementAuthor = supplement && (users.find((user) => user.id === supplement.authorId)?.name ?? supplement.authorId)
  const [documentTab, setDocumentTab] = useState('objective')
  const expressionNode = expression.sourceNode ?? node
  const expressionRevision = expressionNode.expressionSupplement
  const expressionDialogue = expressionNode.expressionConversation ?? []
  const dialogue = [
    ...node.conversation.map((message) => ({ ...message, authorId: node.authorId })),
    ...(node.expressionConversation ?? []).map((message) => ({ ...message, authorId: message.authorId ?? supplement?.authorId ?? node.authorId })),
  ].filter((message) => message.id !== 'welcome' && !message.id.startsWith('error-'))
  const profileLink = `#profile?userId=${encodeURIComponent(node.authorId)}&fromGraph=${encodeURIComponent(project.id)}&fromTab=explore`

  return (
    <section className="max-w-[860px] pb-12 pt-5">
      <header className="pb-5">
        <div className="flex min-w-0 items-center gap-3 text-xs leading-5 text-muted">
          <button className="text-button shrink-0" type="button" onClick={onBack}><ArrowLeft size={15} />回到行动图</button>
          <span className="text-muted/40">/</span>
          <span className="min-w-0 flex-1 truncate" title={project.title}>{project.title}</span>
          <HelpPopover title="形成过程">
            <p>行动和表达由同一条连续 AI 对话整理。修改表达继续已有对话，下方分别查看行动和表达两份文档，不拆分或重复聊天记录。</p>
            <p>表达可以首次填写、修改、继承或清空。继承内容不属于本节点重新生成的结果，可通过来源编号查看实际来源节点的形成过程。</p>
            <p>引用背景根据节点关系整理，不代表已记录 AI 每次请求的实际输入。未引用的其他分支不属于已知行动事实。AI 指引与来源约定分别展示。</p>
            <p>表达更新会接续原有对话，并保留后续整理记录；发布后的约定编辑单独标注。没有记录的过程不作推断。</p>
          </HelpPopover>
        </div>
        <h2 className="mt-3 text-2xl font-semibold leading-[1.5] tracking-[-.03em]">{node.title}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted">
          <ProfilePreview profile={author} userId={node.authorId} className="inline-flex items-center gap-2 text-ink hover:text-signal" href={profileLink}>
            <Avatar profile={author} label={authorName} size="small" /><span className="text-sm font-medium">{authorName}</span>
          </ProfilePreview>
          <time dateTime={node.createdAt} title={formatFullPublicationTime(node.createdAt)}>{formatPublicationTime(node.createdAt)}</time>
          <div className="ml-auto flex items-center gap-2 tabular-nums"><span>节点 #{node.number}</span><span className="text-muted/40">·</span><span>第 {getActionLevels(actions).get(node.id)} 层</span></div>
        </div>
      </header>

      <div className="rounded-lg bg-soft/70 py-1">
        <ArchiveBackground node={node} actions={actions} onSelectSource={onSelectSource} />
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 px-4 py-2.5 text-[13px] leading-6">
          <span className="text-muted">表达</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1"><span>{changeLabels[change.kind]}</span>
              {expressionSource && <button className="border-0 bg-transparent p-0 text-[13px] leading-6 text-signal hover:underline" type="button" onClick={() => onSelectSource(expressionSource.id)} title={`查看表达来源节点 #${expressionSource.number}的形成过程`}>节点 #{expressionSource.number}</button>}
            </div>
            {supplement && <p className="mt-1 text-xs leading-5 text-muted">发布后{getDocumentRevisionLabel(supplement)}表达 · {supplementAuthor} · <time dateTime={supplement.createdAt} title={formatFullPublicationTime(supplement.createdAt)}>{formatPublicationTime(supplement.createdAt)}</time></p>}
          </div>
        </div>
      </div>

      {(agreement.markdown.trim() || node.agreementSupplement) && <details className="group mt-6 rounded-lg border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden"><FileText size={16} className="text-muted" />约定文档<ChevronDown size={15} className="ml-auto text-muted transition-transform group-open:rotate-180" /></summary>
        <div className="border-t border-line px-5 py-5">
          {agreement.sourceNode?.agreementSupplement && <p className="mb-3 text-xs text-muted">未记录编辑对话</p>}
          <AgreementContent agreement={agreement} origin={getActionAgreementOrigin(actions, node.id)} onSelectSource={onSelectSource} />
        </div>
      </details>}

      <ArchiveConversation label="AI 对话" messages={dialogue} authorId={node.authorId} projectId={project.id} users={users} />
      <div className="mt-8">
        <h3 className="text-sm font-medium">文档结果</h3>
        <TabsRoot value={documentTab} onValueChange={setDocumentTab}>
          <TabsList showDivider={false}>
            <TabsTrigger value="objective"><span className="inline-flex items-center gap-1.5"><Footprints size={16} />行动</span></TabsTrigger>
            <TabsTrigger value="expression"><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />表达</span></TabsTrigger>
          </TabsList>
          <TabsContent value="objective" keepMounted>
            <section className="mt-5 rounded-lg border border-line bg-surface p-5">
              <MarkdownContent markdown={node.objectiveMarkdown ?? node.markdown} images={node.images} />
            </section>
          </TabsContent>
          <TabsContent value="expression" keepMounted>
            <section className="mt-5 rounded-lg border border-line bg-surface p-5">
              {expressionRevision && <p className="mb-3 text-xs text-muted">发布后{getDocumentRevisionLabel(expressionRevision)} · {expressionDialogue.length ? '已记录表达对话' : '未记录编辑对话'}</p>}
              {expression.markdown.trim() ? <ExpressionContent expression={expression} origin={getActionExpressionOrigin(actions, node.id)} onSelectSource={onSelectSource} /> : <p className="text-sm text-muted">表达为空</p>}
            </section>
          </TabsContent>
        </TabsRoot>
      </div>
    </section>
  )
}
