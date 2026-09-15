import { ArrowRight, CheckCircle2, Compass, GitFork, ListChecks, Send, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adoptContributionReview, getCall, getContributionSources, getExploreProject, reviewContributions, submitContribution, type CollaborationCall, type CollaborationReviewBatch, type CollaborationSubmission, type ContributionSource, type ExploreProject } from '../lib/collaboration'
import { useExecStore } from '../store/useExecStore'

type CallDetails = { call: CollaborationCall; submissions: CollaborationSubmission[] }

export function PublicProjectPage() {
  const { projectId = '' } = useParams()
  const token = useExecStore((state) => state.accessToken)
  const actor = useExecStore((state) => state.actors.find((item) => item.id === state.currentActorId))
  const [project, setProject] = useState<ExploreProject | null>(null)
  const [details, setDetails] = useState<Record<string, CallDetails>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await getExploreProject(token, projectId)
      setProject(data.project)
      if (token) {
        const calls = await Promise.all(data.project.calls.map((call) => getCall(token, call.id)))
        setDetails(Object.fromEntries(calls.map((item) => [item.call.id, item])))
      } else {
        setDetails({})
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '读取公开项目失败') }
    finally { setLoading(false) }
  }, [projectId, token])

  useEffect(() => { void load() }, [load])
  const isOwner = Boolean(project && actor?.handle.replace(/^@/, '') === project.ownerUserId)
  if (loading) return <p className="text-sm text-graphite">正在读取协作项目...</p>
  if (!project) return <div className="border-l-2 border-rail py-4 pl-5"><h1 className="font-display text-3xl font-semibold text-ink">找不到公开项目</h1><p className="mt-3 text-sm text-clay">{error || '该项目可能已归档或改为私人。'}</p><Link to="/explore" className="mt-4 inline-flex text-sm font-semibold text-signal hover:text-ink">返回协作探索</Link></div>

  return <div className="space-y-9">
    <section className="border-b border-rail pb-7"><Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-signal hover:text-ink"><Compass size={15} />协作探索</Link><div className="mt-5 flex flex-wrap items-center gap-3 font-mono text-xs font-semibold uppercase text-signal"><span>共同难题</span><span>·</span><span>@{project.ownerUserId} 维护</span></div><h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-ink">{project.title}</h1>{project.description ? <p className="mt-4 max-w-3xl text-base leading-7 text-graphite">{project.description}</p> : null}<div className="mt-6 grid max-w-2xl grid-cols-3 divide-x divide-rail border-y border-rail"><Metric label="行动节点" value={project.nodeCount} /><Metric label="已采纳成果" value={project.acceptedCount} /><Metric label="开放缺口" value={project.openCallCount} /></div></section>

    <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="font-mono text-xs font-semibold uppercase text-signal">Contribution map</div><h2 className="mt-2 font-display text-3xl font-semibold">哪些贡献正在把它往前推</h2></div><span className="text-sm font-semibold text-graphite">每份采纳都保留原作者与来源</span></div>{project.calls.length > 0 ? project.calls.map((call) => <ContributionCall key={call.id} call={details[call.id]?.call ?? call} submissions={details[call.id]?.submissions ?? []} token={token} isOwner={isOwner} isAuthenticated={Boolean(token)} onChanged={load} />) : <div className="border-l-2 border-rail py-5 pl-4 text-sm leading-6 text-graphite">维护者尚未发布开放缺口。公开项目可以先沉淀成果，再在需要外部帮助的冻结节点上开启协作。</div>}</section>
  </div>
}

function ContributionCall({ call, submissions, token, isOwner, isAuthenticated, onChanged }: { call: CollaborationCall; submissions: CollaborationSubmission[]; token: string; isOwner: boolean; isAuthenticated: boolean; onChanged: () => Promise<void> }) {
  const [sources, setSources] = useState<ContributionSource[]>([])
  const [sourceRecordId, setSourceRecordId] = useState('')
  const [mapping, setMapping] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [batch, setBatch] = useState<CollaborationReviewBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const isOpen = call.status === 'open'
  const available = Math.max(0, call.maxSubmissions - call.submissionCount)
  const submitted = useMemo(() => submissions.filter((item) => item.status === 'submitted'), [submissions])
  const submittedIDs = useMemo(() => submitted.map((item) => item.id), [submitted])
  const adopted = submissions.filter((item) => item.status === 'adopted')

  useEffect(() => { const availableIDs = new Set(submittedIDs); setSelected((value) => value.filter((id) => availableIDs.has(id))) }, [submittedIDs])
  const loadSources = async () => { try { const data = await getContributionSources(token); setSources(data.sources) } catch (reason) { setMessage(reason instanceof Error ? reason.message : '读取你的公开成果失败') } }
  const submit = async () => { if (!sourceRecordId || mapping.trim().length < 8) { setMessage('选择一份公开成果，并说明它对应目标标准的哪一部分。'); return }; setBusy(true); setMessage(''); try { await submitContribution(token, call.id, sourceRecordId, mapping, note); setSourceRecordId(''); setMapping(''); setNote(''); await onChanged(); setMessage('贡献已提交，等待维护者选择并进行组合审查。') } catch (reason) { setMessage(reason instanceof Error ? reason.message : '提交贡献失败') } finally { setBusy(false) } }
  const review = async () => { if (selected.length === 0) return; setBusy(true); setMessage(''); try { const data = await reviewContributions(token, call.id, selected); setBatch(data.batch); setMessage(data.batch.review.verdict === 'pass' ? 'AI 认为这组贡献满足目标节点的冻结标准。请确认是否采纳。' : 'AI 认为这组贡献仍有缺口，审查结论已保留。') } catch (reason) { setMessage(reason instanceof Error ? reason.message : '组合审查失败') } finally { setBusy(false) } }
  const adopt = async () => { if (!batch) return; setBusy(true); setMessage(''); try { const data = await adoptContributionReview(token, batch.id); setMessage(data.message); await onChanged() } catch (reason) { setMessage(reason instanceof Error ? reason.message : '采纳贡献失败') } finally { setBusy(false) } }

  return <article id={`call-${call.id}`} className="border border-rail bg-surface"><div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_320px]"><div><div className="flex flex-wrap items-center justify-between gap-3"><span className={`font-mono text-xs font-semibold ${isOpen ? 'text-signal' : 'text-moss'}`}>{isOpen ? '开放缺口' : '已采纳'}</span><span className="text-xs font-semibold text-graphite">{isOpen ? `还可接收 ${available} 份贡献` : '这份协作已形成来源记录'}</span></div><h2 className="mt-3 text-2xl font-semibold leading-tight text-ink">{call.title}</h2><p className="mt-3 text-sm leading-6 text-graphite">{call.target.verifiableGoal}</p><div className="mt-5 border-y border-rail py-4"><div className="flex items-center gap-2 text-sm font-semibold text-ink"><ListChecks size={16} className="text-signal" />冻结验收标准</div><ul className="mt-3 space-y-2 text-sm leading-6 text-graphite">{call.target.acceptanceCriteria.map((criterion) => <li key={criterion.id}><span className="font-mono text-xs font-semibold text-signal">{criterion.id.toUpperCase()}</span> {criterion.text}</li>)}</ul></div></div><aside className="border-l border-rail pl-0 xl:pl-5"><div className="font-mono text-xs font-semibold uppercase text-signal">协作状态</div><div className="mt-4 grid gap-3 text-sm"><StatusRow label="已提交" value={`${submissions.length} 份`} /><StatusRow label="已采纳" value={`${adopted.length} 份`} /><StatusRow label="维护者" value={`@${call.ownerUserId}`} /></div></aside></div>
    {submissions.length > 0 ? <div className="divide-y divide-rail border-t border-rail">{submissions.map((submission) => <div key={submission.id} className="grid gap-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">{isOwner && submission.status === 'submitted' ? <input type="checkbox" checked={selected.includes(submission.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, submission.id] : current.filter((id) => id !== submission.id))} className="mt-1.5 size-4 accent-[rgb(var(--color-signal))]" aria-label={`选择 ${submission.sourceTitle}`} /> : <GitFork size={16} className="mt-1 text-signal" />}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-ink">{submission.sourceTitle}</span><span className={`text-xs font-semibold ${submission.status === 'adopted' ? 'text-moss' : 'text-graphite'}`}>{submission.status === 'adopted' ? '已采纳' : '等待组合审查'}</span></div><p className="mt-1 text-xs font-semibold text-graphite">{submission.contributorName} · {submission.sourceProjectTitle}</p><p className="mt-2 text-sm leading-6 text-graphite">{submission.mappingText}</p></div><span className="text-xs text-graphite">{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(submission.createdAt))}</span></div>)}</div> : null}
    {isOpen && !isOwner ? <div className="border-t border-rail p-5">{isAuthenticated ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-ink">把你的成果接到这里</h3><p className="mt-1 text-sm text-graphite">提交自己的公开完成记录，维护者会把它与其他贡献一起组合审查。</p></div><Link to={`/projects/new?fromCall=${call.id}`} className="inline-flex h-10 items-center gap-2 border border-rail bg-surface px-3 text-sm font-semibold text-ink hover:border-signal"><Sparkles size={16} />开始新的贡献</Link></div><div className="mt-5 grid gap-3"><select value={sourceRecordId} onFocus={loadSources} onChange={(event) => setSourceRecordId(event.target.value)} className="h-11 border border-rail bg-paper px-3 text-sm outline-none focus:border-signal"><option value="">选择你已验收的公开成果</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.title} · {source.projectTitle}</option>)}</select><textarea value={mapping} onChange={(event) => setMapping(event.target.value)} className="min-h-20 border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="说明这份成果对应哪些验收标准，以及证据在哪里。" /><textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-16 border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" placeholder="补充说明（可选）" /><button type="button" disabled={busy || available === 0} onClick={submit} className="inline-flex h-10 w-fit items-center gap-2 bg-signal px-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} />提交已有成果</button></div></> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm leading-6 text-graphite">登录后可以提交自己的公开成果，并由维护者组合验收。</p><Link to="/login" className="inline-flex h-10 items-center gap-2 bg-signal px-3 text-sm font-semibold text-white">登录后参与<ArrowRight size={16} /></Link></div>}</div> : null}
    {isOwner && isOpen ? <div className="border-t border-rail bg-shell/55 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-ink">组合验收</h3><p className="mt-1 text-sm text-graphite">选择来源成果后，用本项目配置的 AI 按目标节点的冻结标准审查。</p></div><button type="button" disabled={busy || selected.length === 0} onClick={review} className="inline-flex h-10 items-center gap-2 border border-signal bg-surface px-3 text-sm font-semibold text-signal disabled:opacity-50"><Sparkles size={16} />审查 {selected.length} 份贡献</button></div>{batch ? <div className={`mt-4 border-l-2 py-2 pl-4 text-sm leading-6 ${batch.review.verdict === 'pass' ? 'border-moss text-ink' : 'border-clay text-ink'}`}><div className="font-semibold">AI 审查：{batch.review.verdict === 'pass' ? '通过' : '存在缺口'}</div><p className="mt-1 text-graphite">{batch.review.summary}</p>{batch.status === 'reviewed_pass' ? <button type="button" disabled={busy} onClick={adopt} className="mt-3 inline-flex h-9 items-center gap-2 bg-moss px-3 text-sm font-semibold text-white"><CheckCircle2 size={16} />确认采纳这组贡献</button> : null}</div> : null}</div> : null}
    {message ? <p className="border-t border-rail px-5 py-3 text-sm font-semibold text-graphite">{message}</p> : null}
  </article>
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="px-4 py-4 text-center first:text-left last:text-right"><div className="text-xs font-semibold text-graphite">{label}</div><div className="mt-1 text-xl font-semibold text-ink">{value}</div></div> }
function StatusRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><span className="text-graphite">{label}</span><span className="font-semibold text-ink">{value}</span></div> }
