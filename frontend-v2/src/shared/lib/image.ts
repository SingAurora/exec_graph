export const imageCompressionThreshold = 2 * 1024 * 1024

export type SquareCrop = {
  viewportSize: number
  offsetX: number
  offsetY: number
  renderScale: number
}

export type ImageRenderOptions = {
  outputSize: number
  quality: number
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

/** Reads a local image into a data URL so it can be previewed without uploading it. */
export function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error ?? new Error('无法读取图片')))
    reader.readAsDataURL(file)
  })
}

/** Renders a square crop to a compressed local image data URL. */
export function renderCroppedImage(image: HTMLImageElement, crop: SquareCrop, options: ImageRenderOptions) {
  const canvas = document.createElement('canvas')
  canvas.width = options.outputSize
  canvas.height = options.outputSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片处理')

  const sourceSize = crop.viewportSize / crop.renderScale
  const sourceX = -crop.offsetX / crop.renderScale
  const sourceY = -crop.offsetY / crop.renderScale
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, options.outputSize, options.outputSize)
  return canvas.toDataURL(options.mimeType ?? 'image/jpeg', options.quality)
}
