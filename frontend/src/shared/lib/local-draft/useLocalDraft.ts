import { useEffect, useRef, useState, type SetStateAction } from 'react'
import { readLocalDraft, writeLocalDraft } from './storage'

/** 当前浏览器的草稿恢复／自动保存状态，不表示已向服务发布。 */
export type LocalDraftStatus = 'loading' | 'empty' | 'saving' | 'saved' | 'error'

/** 恢复并自动保存一个编辑器的本地草稿；离开或切到后台时尽力写入最新修改。 */
export function useLocalDraft<T>({ draftKey, initialValue, validate, restore, hasContent }: {
  draftKey?: string
  initialValue: T
  validate: (value: unknown) => value is T
  restore?: (value: T) => T
  hasContent: (value: T) => boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [ready, setReady] = useState(!draftKey)
  const [status, setStatus] = useState<LocalDraftStatus>(draftKey ? 'loading' : 'empty')
  // ref 让异步回调读取最新内容，不受旧渲染闭包影响；value 负责让界面随修改重绘。
  const latest = useRef(initialValue)
  const options = useRef({ initialValue, validate, restore, hasContent })
  options.current = { initialValue, validate, restore, hasContent }
  const active = useRef(false)
  const loaded = useRef(!draftKey)
  const dirty = useRef(false)
  const stopped = useRef(false)
  const revision = useRef(0)

  const persist = () => {
    if (!draftKey || !loaded.current || !dirty.current || stopped.current) return
    dirty.current = false
    // 版本号避免较早一次异步保存完成后，把更新内容的状态错误地标成“已保存”。
    const currentRevision = ++revision.current
    const content = options.current.hasContent(latest.current)
    if (active.current) setStatus('saving')
    void writeLocalDraft(draftKey, latest.current, !content).then(() => {
      if (active.current && currentRevision === revision.current) setStatus(content ? 'saved' : 'empty')
    }).catch(() => {
      if (currentRevision !== revision.current) return
      dirty.current = true
      if (active.current) setStatus('error')
    })
  }
  const persistRef = useRef(persist)
  persistRef.current = persist

  useEffect(() => {
    active.current = true
    stopped.current = false
    let cancelled = false
    if (draftKey) {
      loaded.current = false
      setReady(false)
      void readLocalDraft(draftKey).then((record) => {
        if (cancelled) return
        // 先验证存储版本和业务结构再恢复；loaded 未就绪时 update／persist 都不能覆盖旧草稿。
        const valid = record?.version === 1 && options.current.validate(record.value)
        const restored = valid ? options.current.restore?.(record.value as T) ?? record.value as T : options.current.initialValue
        latest.current = restored
        setValue(restored)
        setStatus(valid && options.current.hasContent(restored) ? 'saved' : 'empty')
      }).catch(() => { if (!cancelled) setStatus('error') }).finally(() => {
        if (cancelled) return
        loaded.current = true
        setReady(true)
      })
    }
    const flush = () => persistRef.current()
    const hide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hide)
    return () => {
      // 清理时忽略未完成的恢复回调，并补存最新修改，避免旧页面回调影响新编辑器。
      cancelled = true
      flush()
      active.current = false
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [draftKey])

  const update = (next: SetStateAction<T>) => {
    if (!loaded.current || !active.current || stopped.current) return
    latest.current = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next
    setValue(latest.current)
    if (!draftKey) return
    dirty.current = true
    ++revision.current
    setStatus('saving')
    persistRef.current()
  }
  // 发布成功后停止后续自动写入再删草稿，防止卸载时的 flush 把已发布草稿写回来。
  const remove = () => {
    stopped.current = true
    dirty.current = false
    ++revision.current
    if (draftKey) void writeLocalDraft(draftKey, undefined, true).catch(() => { if (active.current) setStatus('error') })
  }
  const discard = () => {
    remove()
    latest.current = options.current.initialValue
    setValue(latest.current)
    setStatus('empty')
    stopped.current = false
  }
  return { value, update, ready, status, hasDraft: hasContent(value), remove, discard }
}
