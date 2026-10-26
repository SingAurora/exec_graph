import { useRef } from 'react'
import { retainImages, uploadImage } from '../api/media'

/** 资料图片先本地裁剪，点击保存才上传；业务保存失败后复用已上传资源。 */
export function useImageAssets(csrfToken: string) {
  const uploads = useRef(new Map<string, string>())
  return async (value: string | undefined, previous: string | undefined, previousId: string | null | undefined): Promise<string | null> => {
    if (!value) return null
    if (value === previous) return previousId ?? null
    const existing = uploads.current.get(value)
    if (existing) { await retainImages([existing], csrfToken); return existing }
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
    if (!match) throw new Error('请选择本地图片后保存')
    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
    const image = await uploadImage(new File([bytes], 'image', { type: match[1] }), csrfToken)
    uploads.current.set(value, image.assetId)
    return image.assetId
  }
}
