import { ArrowRight, Bot, Network, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCollaborationCallDetail, submitProjectContribution, type CollaborationCall, type CollaborationSubmission } from '@/features/collaboration/api/client'
import { listAIKeys } from '@/entities/ai-key/api/client'
import { setProjectReviewAI } from '@/entities/project/api/client'
import type { CompletionRecord } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'

type ProjectAIKey = {
  uuid: string
  provider: string
  label: string
  model: string
  baseUrl: string
}

export function ProjectAISettings({ project, accessToken, isArchived, onUpdated }: { project: Project; accessToken: string; isArchived: boolean; onUpdated: () => Promise<unknown> }) {
  const [keys, setKeys] = useState<ProjectAIKey[]>([])
  const [selectedKeyID, setSelectedKeyID] = useState(project.reviewAIKeyUuid ?? '')
  const [isLoading, setIsLoading] = useState(Boolean(accessToken))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setSelectedKeyID(project.reviewAIKeyUuid ?? '')
  }, [project.reviewAIKeyUuid])

  useEffect(() => {
    if (!accessToken) {
      setKeys([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
		const data = await listAIKeys(accessToken)
		if (!cancelled) setKeys(data.keys ?? [])
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '读取 AI 密钥失败。')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [accessToken])

  const save = async () => {
    if (!selectedKeyID || !accessToken) return
    setIsSaving(true)
    setMessage('')
    try {
      await setProjectReviewAI(accessToken, project.uuid, selectedKeyID)
      await onUpdated()
      setMessage('项目审查 AI 已更新。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新项目审查 AI 失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const selected = keys.find((key) => key.uuid === selectedKeyID)
  return (
    <section className="max-w-3xl rounded-md border border-rail bg-surface/72 p-5">
      <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Bot size={17} aria-hidden="true" />Review AI</div>
      <h2 className="mt-2 font-display text-2xl font-semibold">项目审查 AI</h2>
      {isArchived ? <p className="mt-4 text-sm leading-6 text-graphite">项目已归档，审查配置保持为历史记录。</p> : null}
      {!isArchived ? (
        <>
          <label className="mt-5 grid gap-2">
            <span className="text-sm font-semibold text-ink">审核节点描述与完成证明</span>
            <select value={selectedKeyID} onChange={(event) => { setSelectedKeyID(event.target.value); setMessage('') }} disabled={isLoading || !accessToken} className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline">
              <option value="">选择 AI 配置</option>
              {keys.map((key) => <option key={key.uuid} value={key.uuid}>{key.label} · {key.provider} · {key.model}</option>)}
            </select>
          </label>
          {selected ? <p className="mt-3 text-sm text-graphite">{selected.label} · {selected.provider} · {selected.model}</p> : null}
          {keys.length === 0 && !isLoading ? <p className="mt-3 text-sm text-clay">请先到个人设置添加 AI 密钥。</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={!selectedKeyID || selectedKeyID === project.reviewAIKeyUuid || isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:shadow-focusline"><Bot size={16} aria-hidden="true" />保存审查 AI</button>
            {message ? <span className="text-sm font-semibold text-signal">{message}</span> : null}
          </div>
        </>
      ) : null}
    </section>
  )
}

export function ContributionOriginBanner({ origin }: { origin: NonNullable<Project['contributionOrigin']> }) {
  return (
    <section className="grid gap-4 border-y border-rail bg-shell/45 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />协作贡献工作区</div>
        <h2 className="mt-2 text-lg font-semibold text-ink">正在为「{origin.projectTitle}」补上「{origin.callTitle}」</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite">你的行动会围绕这个缺口推进；成果通过验收后，在“成果与封存”中回交给维护者组合审查。</p>
		{origin.availableSources.length > 0 ? <p className="mt-2 max-w-3xl text-xs leading-5 text-graphite">可参考的已有成果：{origin.availableSources.map((source) => `「${source.title}」`).join('、')}。它们是协作背景，不会替代你的独立贡献。</p> : null}
      </div>
      <Link to={`/explore/projects/${origin.projectUuid}#call-${origin.callUuid}`} className="inline-flex h-10 items-center justify-center gap-2 border border-rail bg-surface px-3 text-sm font-semibold text-ink hover:border-signal"><ArrowRight size={16} aria-hidden="true" />查看原始协作目标</Link>
    </section>
  )
}

export function ContributionHandoff({ origin, records, token }: { origin: NonNullable<Project['contributionOrigin']>; records: CompletionRecord[]; token: string }) {
  const [call, setCall] = useState<CollaborationCall | null>(null)
  const [submissions, setSubmissions] = useState<CollaborationSubmission[]>([])
  const [recordID, setRecordID] = useState('')
  const [mapping, setMapping] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getCollaborationCallDetail(token, origin.callUuid)
      setCall(data.call)
      setSubmissions(data.submissions)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '读取协作交接失败')
    }
  }, [origin.callUuid, token])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const available = records.find((record) => !submissions.some((submission) => submission.sourceRecordUuid === record.uuid))
    if (available) setRecordID((current) => current || available.uuid)
  }, [records, submissions])

  const submitted = submissions.filter((submission) => records.some((record) => record.uuid === submission.sourceRecordUuid))
  const availableRecords = records.filter((record) => !submissions.some((submission) => submission.sourceRecordUuid === record.uuid))
  const handoff = async () => {
    if (!recordID || mapping.trim().length < 8) {
      setMessage('说明这份成果对应目标标准的哪一部分，以及证据在哪里。')
      return
    }
    setBusy(true); setMessage('')
    try {
      await submitProjectContribution(token, origin.callUuid, recordID, mapping, '')
      setMapping('')
      setMessage('成果已回交，等待维护者选择来源并进行组合审查。')
      await load()
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '回交成果失败')
    } finally { setBusy(false) }
  }

  return (
    <section className="mb-7 border border-rail bg-surface">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-signal"><Network size={15} aria-hidden="true" />回交协作成果</div>
          <h2 className="mt-2 text-xl font-semibold text-ink">把已验收成果接回「{origin.projectTitle}」</h2>
          <p className="mt-2 text-sm leading-6 text-graphite">目标：{origin.verifiableGoal}</p>
          <div className="mt-4 border-y border-rail py-3 text-sm leading-6 text-graphite">
            {origin.acceptanceCriteria.map((criterion) => <p key={criterion.id}><span className="font-mono text-xs font-semibold text-signal">{criterion.id.toUpperCase()}</span> {criterion.text}</p>)}
          </div>
        </div>
        <aside className="border-l border-rail pl-0 lg:pl-5">
          <div className="font-mono text-xs font-semibold uppercase text-graphite">当前状态</div>
          <div className="mt-3 text-sm leading-6 text-graphite">
            <p><b className="text-ink">{submitted.length}</b> 份本项目成果已回交</p>
            <p className="mt-1">开放缺口：<b className={call?.status === 'open' ? 'text-signal' : 'text-graphite'}>{call?.status === 'open' ? '仍在接收贡献' : call?.status === 'adopted' ? '已形成采纳' : '已关闭'}</b></p>
          </div>
        </aside>
      </div>
      {submitted.length > 0 ? <div className="divide-y divide-rail border-t border-rail">{submitted.map((submission) => <div key={submission.uuid} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><span className="font-semibold text-ink">{submission.sourceTitle}</span><span className={submission.status === 'adopted' ? 'font-semibold text-moss' : 'font-semibold text-graphite'}>{submission.status === 'adopted' ? '已被维护者采纳' : '等待组合审查'}</span></div>)}</div> : null}
      {call?.status === 'open' && availableRecords.length > 0 ? <div className="border-t border-rail bg-shell/45 p-5"><div className="grid gap-3"><select value={recordID} onChange={(event) => setRecordID(event.target.value)} className="h-11 border border-rail bg-paper px-3 text-sm outline-none focus:border-signal"><option value="">选择一份已验收成果</option>{availableRecords.map((record) => <option key={record.uuid} value={record.uuid}>{record.title}</option>)}</select><textarea value={mapping} onChange={(event) => setMapping(event.target.value)} placeholder="说明这份成果对应哪些验收标准，以及证据在哪里。" className="min-h-20 border border-rail bg-paper px-3 py-2 text-sm leading-6 outline-none focus:border-signal" /><button type="button" disabled={busy || !recordID} onClick={() => void handoff()} className="inline-flex h-10 w-fit items-center gap-2 bg-signal px-3 text-sm font-semibold text-white disabled:opacity-50"><Send size={16} aria-hidden="true" />{busy ? '正在回交' : '提交回协作目标'}</button></div></div> : null}
      {availableRecords.length === 0 && submitted.length === 0 ? <p className="border-t border-rail px-5 py-4 text-sm leading-6 text-graphite">先完成并确认至少一项行动成果，它会出现在这里供你回交。</p> : null}
      {message ? <p className="border-t border-rail px-5 py-3 text-sm font-semibold text-graphite">{message}</p> : null}
    </section>
  )
}

