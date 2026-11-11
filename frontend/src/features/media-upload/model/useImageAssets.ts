import { useCallback, useRef } from 'react'
import { retainImages, uploadImage } from '../api/media'

/** 编辑中的图片值：新图是 data URL，旧图是服务端 URL。 */
type ImageValue = string | undefined

/** 同一 owner 下，同一张 data URL 只上传一次。 */
function cacheKey(ownerScope: string, value: string) {
  return ownerScope + '\n' + value
}

/** 把前端裁剪产生的 JPEG/PNG/WebP data URL 还原成可上传文件。 */
function imageFileFromDataUrl(value: string): File {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value)
  if (!match) throw new Error('请选择本地图片后保存')

  const [, mimeType, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], 'image', { type: mimeType })
}

/**
 * 资料图片先本地裁剪，点击保存才上传；业务保存失败后复用已上传资源。
 *
 * ownerScope 用来隔离不同业务，例如 `profile:<uuid>`、`graph:<uuid>`。
 * 同一张图不能跨 owner 复用。
 */
export function useImageAssets() {
  const uploadedAssets = useRef(new Map<string, string>())

  return useCallback(async (
    value: ImageValue,
    previous: ImageValue,
    previousId: string | null | undefined,
    ownerScope: string,
  ): Promise<string | null> => {
    // 用户清空了图片。
    if (!value) return null

    // 图片没换，继续使用原来的资产，不需要重新上传。
    if (value === previous) return previousId ?? null

    // 同一次编辑里已经上传过这张图，复用并延长一下草稿保留期。
    const existing = uploadedAssets.current.get(cacheKey(ownerScope, value))
    if (existing) {
      await retainImages([existing])
      return existing
    }

    // 新图：上传后记住 assetUuid，保存失败重试时不再重复上传。
    const asset = await uploadImage(imageFileFromDataUrl(value))
    uploadedAssets.current.set(cacheKey(ownerScope, value), asset.assetUuid)
    return asset.assetUuid
  }, [])
}
