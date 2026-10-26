import { useEffect, useRef } from 'react'
import { generateDraft, type GenerationRequest } from '../api/generation'

/** 离开工作区取消等待和轮询，提交身份仍由本地草稿保存供恢复。 */
export function useGeneration(csrfToken: string) {
  const controller = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controller.current?.abort(), [])
  return (request: GenerationRequest) => {
    controller.current?.abort()
    controller.current = new AbortController()
    return generateDraft(request, csrfToken, controller.current.signal)
  }
}
