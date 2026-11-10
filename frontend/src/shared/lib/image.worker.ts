/// <reference lib="webworker" />

type CompressRequest = { file: File; maxWidth: number; maxHeight: number; quality: number }

self.onmessage = async (event: MessageEvent<CompressRequest>) => {
  try {
    const { file, maxWidth, maxHeight, quality } = event.data
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持图片处理')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    self.postMessage({ blob })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '图片处理失败' })
  }
}
