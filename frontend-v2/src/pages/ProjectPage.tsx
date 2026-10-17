import { ArrowRight, Flame, GitBranch, Medal, MessageCircle, Plus, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActionNode } from '../entities/action/model/types'
import { getActionContextIds, getActionParentIds, getActionPostCount, getActionPostNodes, getAncestors, getPathThrough, getPreferredPath } from '../entities/action/lib/graph'
import { getActionReferences } from '../entities/action/lib/references'
import { ActionGraph } from '../widgets/action-graph/ui/ActionGraph'
import { ActionReferenceDetail } from '../widgets/action-reference/ui/ActionReferenceDetail'
import type { BranchMode, Project, UserProfile } from '../shared/model'
import { Avatar } from '../shared/ui/Avatar'
import { MarkdownContent } from '../shared/ui/MarkdownContent'
import { RecordImages } from '../shared/ui/RecordImages'
import { HelpPopover } from '../shared/ui/help/HelpPopover'
import { ProjectSettingsPanel } from '../features/project/ui/ProjectSettingsPanel'
import { ActionPostList, type ActionPost } from '../widgets/action-posts/ui/ActionPostList'

type ProjectPageProps = {
  project: Project
  currentUserId: string
  users: UserProfile[]
  actions: ActionNode[]
  showActionGraphLegend: boolean
  onCreateAction: (projectId: string) => void
  onContinueAction: (node: ActionNode, mode: BranchMode) => void
  onOpenActionArchive: (node: ActionNode) => void
  onUpdateProject: (projectId: string, patch: Pick<Project, 'title' | 'description' | 'avatar' | 'backgroundImage'>) => void
}

type GraphSelection = { kind: 'node' | 'reference'; id: string }
type ProjectContentTab = 'featured' | 'hot' | 'latest' | 'explore'
type ProjectTab = ProjectContentTab | 'settings'

export function ProjectPage({ project, currentUserId, users, actions, showActionGraphLegend, onCreateAction, onContinueAction, onOpenActionArchive, onUpdateProject }: ProjectPageProps) {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const userById = new Map(users.map((user) => [user.id, user]))
  const [activeTab, setActiveTab] = useState<ProjectTab>('latest')
  const [selectedPostId, setSelectedPostId] = useState<string>()
  const preferredPath = useMemo(() => getPreferredPath(actions), [actions])
  const postNodes = useMemo(() => getActionPostNodes(actions), [actions])
  const posts = useMemo(() => postNodes.map((node): ActionPost => {
    const contextIds = getActionContextIds(actions, node.id)
    const path = getAncestors(actions, node.id)
    return { node, summary: getPostSummary(node), pathLength: path.length, participantCount: new Set([...contextIds].map((id) => actions.find((item) => item.id === id)?.authorId).filter(Boolean)).size, mergedCount: node.mergedParentIds?.length ?? 0 }
  }), [actions, postNodes])
  const postsByCategory = useMemo(() => ({
    featured: [...posts].sort((a, b) => b.mergedCount - a.mergedCount || b.pathLength - a.pathLength || b.node.number - a.node.number),
    hot: [...posts].sort((a, b) => postScore(b) - postScore(a) || b.node.number - a.node.number),
    latest: [...posts].sort((a, b) => b.node.number - a.node.number),
  }), [posts])
  const selectedPostMainPath = useMemo(() => selectedPostId ? getPathThrough(actions, selectedPostId) : [], [actions, selectedPostId])
  const mainPath = activeTab === 'explore' && selectedPostMainPath.length ? selectedPostMainPath : preferredPath
  const references = useMemo(() => getActionReferences(actions), [actions])
  const stats = useMemo(() => {
    const latestAction = actions.reduce<ActionNode | undefined>((latest, action) => !latest || new Date(action.createdAt).getTime() > new Date(latest.createdAt).getTime() ? action : latest, undefined)
    return {
      participants: new Set(actions.map((action) => action.authorId)).size,
      posts: getActionPostCount(actions),
      nodes: actions.length,
      updatedAt: latestAction?.createdAt ?? project.updatedAt,
    }
  }, [actions, project.updatedAt])
  const contributorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const action of actions) counts.set(action.authorId, (counts.get(action.authorId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
  }, [actions])
  const canEditProject = project.ownerId === currentUserId || contributorCounts.includes(currentUserId)
  const [selection, setSelection] = useState<GraphSelection | undefined>(() => {
    const tip = mainPath.at(-1)
    return tip ? { kind: 'node', id: tip.id } : undefined
  })
  const selectedReference = selection?.kind === 'reference' ? references.find((reference) => reference.id === selection.id) : undefined
  const selected = selectedReference ? undefined : actions.find((node) => selection?.kind === 'node' && node.id === selection.id) ?? mainPath.at(-1)
  const isMain = selected ? mainPath.some((node) => node.id === selected.id) : true
  const selectNode = (id: string) => setSelection({ kind: 'node', id })

  useEffect(() => {
    const exists = selection?.kind === 'reference' ? references.some((reference) => reference.id === selection.id)
      : selection && actions.some((node) => node.id === selection.id)
    if (!exists) {
      const tip = mainPath.at(-1)
      if (selection || tip) setSelection(tip ? { kind: 'node', id: tip.id } : undefined)
    }
  }, [actions, mainPath, references, selection])

  const createFirstPost = () => {
    const root = actions.find((node) => !node.parentId && !node.mergedParentIds?.length)
    if (root) onContinueAction(root, 'continue')
    else onCreateAction(project.id)
  }
  const openPost = (post: ActionPost) => { setSelectedPostId(post.node.id); setSelection({ kind: 'node', id: post.node.id }); setActiveTab('explore') }
  const openSettings = () => setActiveTab('settings')

  return <section className="max-w-[1000px] pt-0 max-[700px]:pt-7">
    <header className="relative min-h-[156px] overflow-hidden border border-line bg-surface px-6 pb-6 pt-7 max-[700px]:px-4">
      {project.backgroundImage ? <div className="absolute inset-0 bg-cover bg-center opacity-[0.15]" style={{ backgroundImage: `url("${project.backgroundImage}")` }} aria-hidden="true" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgb(35_107_89_/_0.1),transparent_38%)]" aria-hidden="true" />}
      <div className="relative flex items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3.5">
          <ProjectAvatar project={project} size="large" />
          <div className="min-w-0">
            <h2 className="truncate text-[24px] tracking-[-.04em] max-[700px]:text-[21px]">{project.title}</h2>
            <p className="mt-2 line-clamp-3 max-w-[700px] text-[13px] leading-[1.7] text-muted">{project.description}</p>
          </div>
        </div>
      </div>
    </header>
    <nav className="mt-5 flex gap-6 border-b border-line max-[700px]:gap-4" role="tablist" aria-label="行动图内容分类">
      {(['featured', 'hot', 'latest', 'explore'] as const).map((tab) => { const Icon = tab === 'explore' ? Sparkles : tab === 'featured' ? Medal : tab === 'hot' ? Flame : Plus; return <button className={`inline-flex min-h-[43px] items-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-0 text-[13px] font-semibold text-muted transition hover:text-ink ${activeTab === tab ? 'border-signal text-signal' : ''}`} type="button" role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)}><Icon size={14} />{tab === 'explore' ? '探索图' : tab === 'featured' ? '精华' : tab === 'hot' ? '热门' : '最新'}</button> })}
      {canEditProject && <button className={`inline-flex min-h-[43px] items-center gap-1.5 border-0 border-b-2 bg-transparent px-0 text-[13px] font-semibold transition ${activeTab === 'settings' ? 'border-signal text-signal' : 'border-transparent text-muted hover:text-ink'}`} type="button" role="tab" aria-selected={activeTab === 'settings'} aria-controls="project-settings" aria-label="图设置" title="图设置" onClick={openSettings}><Settings2 size={14} aria-hidden="true" />设置</button>}
    </nav>
    {activeTab === 'settings' ? <ProjectSettingsPanel id="project-settings" project={project} onSave={(patch) => onUpdateProject(project.id, patch)} /> : activeTab !== 'explore' ? <div className="mt-5 grid grid-cols-[minmax(0,1fr)_220px] items-start gap-7 max-[800px]:grid-cols-1"><div><ActionPostList posts={postsByCategory[activeTab]} users={users} category={activeTab} onOpenPost={openPost} onCreate={createFirstPost} /></div><GraphInfoAside stats={stats} /></div> : !actions.length ? <EmptyActions onCreate={() => onCreateAction(project.id)} /> : <div ref={workspaceRef} className="mt-5 grid h-dvh grid-cols-[342px_minmax(0,1fr)] overflow-hidden border border-line bg-surface" role="region" aria-label="行动阅读工作区">
      <ActionGraph key={project.id} actions={actions} mainPath={mainPath} users={users} selectedId={selected?.id} selectedReferenceId={selectedReference?.id} showLegend={showActionGraphLegend} onSelect={selectNode} onSelectReference={(id) => setSelection({ kind: 'reference', id })} onFitViewport={() => workspaceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })} />
      <main key={selectedReference?.id ?? selected?.id} className="min-h-0 min-w-0 overflow-y-auto" aria-label={selectedReference ? '选中引用关系详情' : '选中行动节点详情'}>
        {selectedReference ? <ActionReferenceDetail reference={selectedReference} actions={actions} users={users} onSelectNode={selectNode} />
          : selected ? <><ActionSources node={selected} actions={actions} onSelect={selectNode} /><ActionDetail key={selected.id} node={selected} author={userById.get(selected.authorId)} isMain={isMain} defaultMode={selectedPostId === selected.id ? 'expression' : 'objective'} branches={actions.filter((node) => node.parentId === selected.id)} onOpenArchive={() => onOpenActionArchive(selected)} onContinue={() => onContinueAction(selected, 'continue')} onFork={() => onContinueAction(selected, 'fork')} onSelect={selectNode} /></>
            : <p className="p-6 text-[13px] text-muted">选择左侧节点查看行动记录。</p>}
      </main>
    </div>}
  </section>
}

function ProjectAvatar({ project, size = 'small' }: { project: Project; size?: 'small' | 'large' }) {
  const className = `grid ${size === 'large' ? 'size-14 rounded-[16px] text-xl' : 'size-11 rounded-[13px] text-base'} flex-none place-items-center overflow-hidden bg-signal-soft font-bold text-signal ${project.avatar ? 'bg-cover bg-center text-transparent' : ''}`
  return <span className={className} style={project.avatar ? { backgroundImage: `url("${project.avatar}")` } : undefined}>{project.avatar ? '' : project.title.slice(0, 1)}</span>
}

function getPostSummary(node: ActionNode) {
  const source = node.expressionMarkdown || node.objectiveMarkdown || node.markdown
  const text = source.split('\n').map((line) => line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim()).filter(Boolean).join(' ')
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text
}

function postScore(post: ActionPost) {
  return post.participantCount * 8 + post.pathLength * 3 + post.mergedCount * 10 + post.node.number / 100
}

function formatGraphDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function GraphInfoAside({ stats }: { stats: { participants: number; posts: number; nodes: number; updatedAt: string } }) {
  return <aside className="border border-line bg-surface p-5 max-[800px]:p-4" aria-label="图信息"><h3 className="text-[15px] font-semibold">图信息</h3><dl className="mt-4 grid grid-cols-2 border-y border-line"><div className="grid gap-1 border-r border-b border-line py-3 pr-3"><dd className="font-sans text-[17px] leading-none text-ink">{stats.participants}</dd><dt className="text-[10px] text-muted">参与人</dt></div><div className="grid gap-1 border-b border-line py-3 pl-3"><dd className="font-sans text-[17px] leading-none text-ink">{stats.posts}</dd><dt className="text-[10px] text-muted">帖子</dt></div><div className="grid gap-1 border-r border-line py-3 pr-3"><dd className="font-sans text-[17px] leading-none text-ink">{stats.nodes}</dd><dt className="text-[10px] text-muted">行动节点</dt></div><div className="grid min-w-0 gap-1 py-3 pl-3"><dd className="truncate font-sans text-[13px] leading-none text-ink">{formatGraphDate(stats.updatedAt)}</dd><dt className="text-[10px] text-muted">最近更新</dt></div></dl></aside>
}

function ActionSources({ node, actions, onSelect }: { node: ActionNode; actions: ActionNode[]; onSelect: (id: string) => void }) {
  const parents = getActionParentIds(node).map((id) => actions.find((action) => action.id === id)).filter((action) => action !== undefined)
  if (!parents.length) return null
  return <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-6 py-2.5 text-[10px] text-muted"><span>{parents.length > 1 ? '承接与合入' : '承接自'}</span>{parents.slice(0, 3).map((parent) => <button className="border-0 bg-transparent p-0 font-semibold text-signal hover:underline" type="button" key={parent.id} title={parent.title} onClick={() => onSelect(parent.id)}>节点 #{parent.number}</button>)}{parents.length > 3 && <span>等 {parents.length} 个直接来源</span>}</div>
}

function ActionDetail({ node, author, isMain, defaultMode, branches, onOpenArchive, onContinue, onFork, onSelect }: { node: ActionNode; author?: UserProfile; isMain: boolean; defaultMode: 'objective' | 'expression'; branches: ActionNode[]; onOpenArchive: () => void; onContinue: () => void; onFork: () => void; onSelect: (nodeId: string) => void }) {
  const [recordMode, setRecordMode] = useState<'objective' | 'expression'>(defaultMode)
  useEffect(() => setRecordMode(defaultMode), [node.id, defaultMode])
  const objectiveMarkdown = node.objectiveMarkdown ?? node.markdown
  const expressionMarkdown = node.expressionMarkdown ?? ''
  const context = node.contextSnapshot
  return <article><header className="border-b border-line px-6 py-[19px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><span className="section-kicker">{isMain ? '主线行动' : '支链行动'}</span><span className="font-sans text-[10px] font-bold text-muted">节点 #{node.number}</span></div><h3 className="mt-[7px] text-[23px] tracking-[-.03em] max-[700px]:text-[20px]">{node.title}</h3><div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted">
      <span className="inline-flex min-w-0 items-center gap-2">
        <Avatar profile={author} label={(author?.name ?? node.authorId).slice(0, 1)} size="tiny" />
        <span className="max-w-[180px] truncate text-xs font-medium leading-5 text-ink">{author?.name ?? node.authorId}</span>
      </span>
      <span className="text-[10px]" aria-hidden="true">·</span>
      <time className="text-[11px] leading-5" dateTime={node.createdAt}>{node.createdAt.replace('T', ' ').slice(0, 16)}</time>
    </div></header><div className="border-b border-line px-6 py-2 max-[700px]:px-4">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-5" role="group" aria-label="文档类型">
      <button className={`border-0 bg-transparent px-0 py-1 text-xs font-semibold transition-colors ${recordMode === 'objective' ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={recordMode === 'objective'} onClick={() => setRecordMode('objective')}>记录</button>
      <button className={`border-0 bg-transparent px-0 py-1 text-xs font-semibold transition-colors ${recordMode === 'expression' ? 'text-signal' : 'text-muted hover:text-signal'}`} type="button" aria-pressed={recordMode === 'expression'} onClick={() => setRecordMode('expression')}>表达</button>
    </div><HelpPopover title="记录与表达">
      <p>记录描述本次行动实际发生的事情；表达基于本次行动和被引用的历史形成观点。</p>
      <p>两份文档由行动者与 AI 的连续对话整理。点击“查看形成过程”可查看完整文档、上下文来源和 AI 对话。</p>
    </HelpPopover></div>{recordMode === 'expression' && <div className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted"><span>基于 {context?.historyNodeCount ?? Math.max(0, node.number - 1)} 个历史节点</span>{context?.directNodeIds.length ? <span>直接承接：{context.directNodeIds.map((id) => `节点 #${id.split('-').at(-1)}`).join('、')}</span> : <span>这是行动图的起点</span>}{context?.guide && <span className="text-signal">已使用行动图指引</span>}</div>}</div><div className="px-6 py-6 max-[700px]:px-4"><MarkdownContent markdown={recordMode === 'expression' ? expressionMarkdown || '这条行动还没有单独记录行动表达。' : objectiveMarkdown} />{recordMode === 'objective' && <RecordImages images={node.images} />}</div><div className="border-t border-line px-6 py-[15px] max-[700px]:px-4"><div className="flex flex-wrap items-center gap-2.5"><button className="primary-button min-h-[34px] px-3 py-2 text-xs" type="button" onClick={onContinue}><ArrowRight size={14} />沿此接续</button><button className="quiet-button" type="button" onClick={onFork}><GitBranch size={14} />另开支链</button><button className="quiet-button" type="button" onClick={onOpenArchive}><MessageCircle size={14} />查看形成过程</button></div></div>{branches.length > 0 && <section className="border-t border-line px-6 py-[18px] max-[700px]:px-4"><div className="flex items-center justify-between gap-3"><div><span className="section-kicker">行动分支</span><h4 className="mt-1 text-[17px]">从这里继续的人</h4></div><span className="text-[10px] text-muted">{branches.length} 条路线</span></div><div className="mt-3 grid gap-2">{branches.map((branch) => <button className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-0 border-b border-line bg-transparent px-0 py-3 text-left hover:text-signal" type="button" key={branch.id} onClick={() => onSelect(branch.id)}><span className="grid gap-1"><strong className="text-xs">{branch.title}</strong><small className="text-[10px] text-muted">节点 #{branch.number} · {branch.authorId}</small></span><ArrowRight size={15} className="text-signal" /></button>)}</div></section>}</article>
}

function EmptyActions({ onCreate }: { onCreate: () => void }) { return <div className="mt-[30px] border-y border-line py-14 text-center"><Sparkles size={24} className="mx-auto text-signal" /><h3 className="mt-3 text-[17px]">还没有行动记录</h3><button className="primary-button mt-5" type="button" onClick={onCreate}><Plus size={15} />记录第一次行动</button></div> }
