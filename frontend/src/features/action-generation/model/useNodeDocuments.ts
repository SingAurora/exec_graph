import { useCallback, useEffect, useState } from 'react'
import type { ActionNode } from '../../../entities/action/model/types'
import { generateNodeDocuments, getNodeDocuments, publishNodeDocument, type NodeDocument } from '../api/generation'

type Kind = 'expression' | 'agreement'

/** 作者自己的节点文档状态；只在节点未完成时轮询 AI 草稿。 */
export function useNodeDocuments({ node, csrfToken, enabled, onPublished }: {
  node?: ActionNode
  csrfToken: string
  enabled: boolean
  onPublished?: (nodeUuid: string, expectedVersion: number, kind: Kind) => Promise<void>
}) {
  const [documents, setDocuments] = useState<NodeDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [working, setWorking] = useState<Kind | 'generate' | ''>('')

  const load = useCallback(async () => {
    if (!node || !enabled) { setDocuments([]); return }
    try {
      const next = await getNodeDocuments(node.uuid)
      setDocuments(next)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取节点文档失败')
    } finally { setLoading(false) }
  }, [enabled, node])

  useEffect(() => {
    if (!node || !enabled) { setDocuments([]); setLoading(false); return }
    let active = true
    let timer: number | undefined
    setLoading(true)
    const run = async () => {
      try {
        const next = await getNodeDocuments(node.uuid)
        if (!active) return
        setDocuments(next)
        setError('')
        if (next.some((document) => document.status === 'pending' || document.status === 'generating')) timer = window.setTimeout(run, 2000)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '读取节点文档失败')
      } finally { if (active) setLoading(false) }
    }
    void run()
    return () => { active = false; if (timer !== undefined) window.clearTimeout(timer) }
  }, [enabled, node])

  const retry = async () => {
    if (!node) return
    setWorking('generate'); setError('')
    try { setDocuments(await generateNodeDocuments(node.uuid, csrfToken)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '生成失败，请重试') }
    finally { setWorking('') }
  }
  const publish = async (kind: Kind) => {
    if (!node) return
    setWorking(kind); setError('')
    try {
      if (onPublished) await onPublished(node.uuid, node.version ?? 0, kind)
      else await publishNodeDocument(node.uuid, node.version ?? 0, kind, csrfToken)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '发布失败，请重试') }
    finally { setWorking('') }
  }
  return { documents, loading, error, working, retry, publish }
}
