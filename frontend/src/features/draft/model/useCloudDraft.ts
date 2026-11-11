import { useEffect, useRef, useState, type SetStateAction } from 'react'
import { deleteDraft, draftKeys, readDraft, saveDraft, type DraftScope } from '../../../entities/draft/api/drafts'

/** 云端草稿的恢复/自动保存状态。 */
export type CloudDraftStatus = 'loading' | 'empty' | 'saving' | 'saved' | 'error' | 'conflict'

type Options<T> = {
  scope?: DraftScope
  initialValue: T
  validate: (value: unknown) => value is T
  restore?: (value: T) => T
  hasContent: (value: T) => boolean
}

function scopeKey(scope?: DraftScope) {
  return scope ? draftKeys.detail(scope).join('/') : ''
}

function assetUuids(value: unknown): string[] {
  if (!value || typeof value !== 'object' || !('images' in value)) return []
  const images = (value as { images?: unknown }).images
  if (!Array.isArray(images)) return []
  return images.flatMap((image) => image && typeof image === 'object' && typeof (image as { assetUuid?: unknown }).assetUuid === 'string' ? [(image as { assetUuid: string }).assetUuid] : [])
}

/** 云端工作区草稿；读取和保存都会续期 7 天，不做本地缓存。 */
export function useCloudDraft<T>({ scope, initialValue, validate, restore, hasContent }: Options<T>) {
  const [value, setValue] = useState(initialValue)
  const [ready, setReady] = useState(!scope)
  const [status, setStatus] = useState<CloudDraftStatus>(scope ? 'loading' : 'empty')
  const latest = useRef(initialValue)
  const options = useRef({ initialValue, validate, restore, hasContent })
  options.current = { initialValue, validate, restore, hasContent }
  const version = useRef(0)
  const active = useRef(false)
  const loaded = useRef(!scope)
  const dirty = useRef(false)
  const stopped = useRef(false)
  const revision = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const persist = async () => {
    if (!scope || !loaded.current || !dirty.current || stopped.current) return
    dirty.current = false
    const currentRevision = ++revision.current
    const content = options.current.hasContent(latest.current)
    if (active.current) setStatus('saving')
    try {
      const saved = await saveDraft(scope, latest.current, assetUuids(latest.current), version.current)
      version.current = saved.version
      if (active.current && currentRevision === revision.current) setStatus(content ? 'saved' : 'empty')
    } catch (error) {
      dirty.current = true
      if (currentRevision !== revision.current) return
      if (active.current) setStatus(error instanceof Error && /其他页面/.test(error.message) ? 'conflict' : 'error')
    }
  }
  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    active.current = true
    stopped.current = false
    dirty.current = false
    let cancelled = false
    if (!scope) {
      loaded.current = true
      setReady(true)
      setStatus('empty')
      return
    }
    loaded.current = false
    setReady(false)
    setStatus('loading')
    void readDraft(scope)
      .then((draft) => {
        if (cancelled) return
        version.current = draft?.version ?? 0
        const valid = draft && options.current.validate(draft.payload)
        const restored = valid ? options.current.restore?.(draft.payload as T) ?? draft.payload as T : options.current.initialValue
        latest.current = restored
        setValue(restored)
        setStatus(valid && options.current.hasContent(restored) ? 'saved' : 'empty')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
      .finally(() => {
        if (cancelled) return
        loaded.current = true
        setReady(true)
      })
    return () => {
      cancelled = true
      if (timer.current !== undefined) window.clearTimeout(timer.current)
      void persistRef.current()
      active.current = false
    }
    // 作用域变化时重新读取；对象引用每次渲染都变，使用 key 控制。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey(scope)])

  const update = (next: SetStateAction<T>) => {
    if (!loaded.current || stopped.current) return
    latest.current = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next
    setValue(latest.current)
    dirty.current = true
    setStatus('saving')
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { void persistRef.current() }, 1000)
  }

  const remove = async () => {
    stopped.current = true
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    if (scope) await deleteDraft(scope).catch(() => undefined)
    version.current = 0
    loaded.current = true
    setStatus('empty')
  }

  const discard = () => {
    stopped.current = true
    if (scope) void deleteDraft(scope).catch(() => undefined)
    version.current = 0
    latest.current = options.current.initialValue
    setValue(options.current.initialValue)
    setStatus('empty')
    stopped.current = false
    dirty.current = false
  }

  return { value, update, ready, status, hasDraft: hasContent(value), remove, discard }
}
