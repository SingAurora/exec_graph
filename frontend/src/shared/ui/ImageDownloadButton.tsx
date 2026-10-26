import { Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { getBlob } from '../api/client'
import type { PostImage } from '../model/content'
import { useToast } from './toast/useToast'

/** Downloads the original image without navigating away from its preview. */
export function ImageDownloadButton({ image }: { image: PostImage }) {
  const [downloading, setDownloading] = useState(false)
  const { showToast } = useToast()

  const download = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await getBlob(image.url)
      if (!blob.type.startsWith('image/')) throw new Error('无法下载图片')
      const extension = blob.type.split('/')[1].split(';')[0].replace('jpeg', 'jpg').replace('svg+xml', 'svg')
      const filename = image.alt.replace(/[<>:"/\\|?*]/g, '').trim().slice(0, 100) || '图片'
      const objectURL = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectURL
      link.download = `${filename}.${extension}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectURL), 60_000)
    } catch {
      showToast({ kind: 'error', message: '图片下载失败，请重试' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button type="button" className="icon-button shrink-0" aria-label="下载图片" title="下载图片" disabled={downloading} onClick={() => { void download() }}>
      {downloading ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
    </button>
  )
}
