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
