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

export type RectangularCrop = {
  viewportWidth: number
  viewportHeight: number
  offsetX: number
  offsetY: number
  renderScale: number
}

export type RectangularImageRenderOptions = Omit<ImageRenderOptions, 'outputSize'> & {
  outputWidth: number
  outputHeight: number
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

export type ScaledImageOptions = {
  maxWidth: number
  maxHeight: number
  quality: number
}

/** Loads a local image URL so it can be measured and compressed without cropping. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('图片无法读取')))
    image.src = url
  })
}

/** Scales the full image down to fit a bounding box, preserving aspect ratio and never upscaling. */
export function renderScaledImage(image: HTMLImageElement, options: ScaledImageOptions) {
  const scale = Math.min(1, options.maxWidth / image.naturalWidth, options.maxHeight / image.naturalHeight)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片处理')
  // Flatten transparency to white when exporting JPEG instead of producing black areas.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', options.quality)
}

/** Converts a cropped data URL back to a File for the existing media upload API. */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('图片数据格式不正确')
  const header = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  const mimeType = /^data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg'
  if (!header.includes(';base64')) throw new Error('图片数据格式不正确')
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], filename, { type: mimeType })
}

/** Renders a square crop to a compressed local image data URL. */
export function renderCroppedImage(image: HTMLImageElement, crop: SquareCrop, options: ImageRenderOptions) {
  return renderRectangularCroppedImage(image, {
    viewportWidth: crop.viewportSize, viewportHeight: crop.viewportSize,
    offsetX: crop.offsetX, offsetY: crop.offsetY, renderScale: crop.renderScale,
  }, { outputWidth: options.outputSize, outputHeight: options.outputSize, quality: options.quality, mimeType: options.mimeType })
}

/** Encodes the chosen crop as a compressed image, without enlarging a small original. */
export function renderRectangularCroppedImage(image: HTMLImageElement, crop: RectangularCrop, options: RectangularImageRenderOptions) {
  const sourceWidth = crop.viewportWidth / crop.renderScale
  const sourceHeight = crop.viewportHeight / crop.renderScale
  const outputScale = Math.min(1, sourceWidth / options.outputWidth, sourceHeight / options.outputHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(options.outputWidth * outputScale))
  canvas.height = Math.max(1, Math.round(options.outputHeight * outputScale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片处理')

  const sourceX = Math.max(0, -crop.offsetX / crop.renderScale)
  const sourceY = Math.max(0, -crop.offsetY / crop.renderScale)
  // Flatten transparency to white when exporting JPEG instead of producing black areas.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(options.mimeType ?? 'image/jpeg', options.quality)
}

/** 在 Worker 中把图片缩放并编码为 JPEG Blob；不支持时回退主线程异步编码。 */
export async function compressImageFile(file: File, options: ScaledImageOptions): Promise<Blob> {
  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
      const result = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
          if (event.data.blob) resolve(event.data.blob)
          else reject(new Error(event.data.error ?? '图片处理失败'))
        }
        worker.onerror = () => reject(new Error('图片处理失败'))
        worker.postMessage({ file, ...options })
      })
      worker.terminate()
      return result
    } catch {
      // 回退到主线程的异步编码。
    }
  }
  const source = URL.createObjectURL(file)
  try {
    const image = await loadImage(source)
    const scale = Math.min(1, options.maxWidth / image.naturalWidth, options.maxHeight / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持图片处理')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片处理失败')), 'image/jpeg', options.quality))
  } finally {
    URL.revokeObjectURL(source)
  }
}
