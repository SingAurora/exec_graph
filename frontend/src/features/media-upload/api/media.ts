import { postAPI, postFormAPI } from '../../../shared/api/client'

/** 上传成功不代表已被业务引用；retainUntil 之前需保存或为草稿续期。 */
export type UploadedImage = { assetId: string; url: string; mimeType: string; byteSize: number; width: number; height: number; retainUntil: string }

/** 上传真实图片文件，服务端独立校验内容和归属。 */
export function uploadImage(file: File, csrfToken: string): Promise<UploadedImage> {
  const body = new FormData()
  body.append('file', file)
  return postFormAPI('/api/commands/media/upload', body, { csrfToken, timeoutMs: 60_000 })
}
/** 恢复或继续编辑草稿时延长本人图片的保留期。 */
export function retainImages(assetIds: string[], csrfToken: string): Promise<{ assetIds: string[]; retainUntil: string }> {
  return postAPI('/api/commands/media/retain', { assetIds }, { csrfToken })
}
