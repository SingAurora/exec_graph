import Cropper, { type Area, type Point } from 'react-easy-crop'
import { ImagePlus, LoaderCircle, ZoomIn } from 'lucide-react'
import { ChangeEvent, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

type AvatarCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (file: File) => Promise<void>
  isSaving: boolean
}

const maxUploadBytes = 2 * 1024 * 1024

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法读取这张图片。'))
    image.src = src
  })
}

async function createCroppedAvatar(imageSrc: string, area: Area) {
  const image = await loadImage(imageSrc)
  const targetSize = 512
  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器无法处理这张图片。')

  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, targetSize, targetSize)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error('裁剪头像失败，请重试。')
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}

export function AvatarCropDialog({ open, onOpenChange, onSave, isSaving }: AvatarCropDialogProps) {
  const [imageSrc, setImageSrc] = useState('')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
  }, [imageSrc])

  const reset = () => {
    setImageSrc('')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setMessage('')
  }

  const close = () => {
    if (isSaving) return
    reset()
    onOpenChange(false)
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage('请选择 PNG、JPEG 或 WebP 图片。')
      return
    }
    if (file.size > maxUploadBytes) {
      setMessage('头像文件不能超过 2 MB。')
      return
    }
    setImageSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
    setMessage('')
  }

  const save = async () => {
    if (!imageSrc || !croppedArea) {
      setMessage('请先选择一张图片。')
      return
    }
    setMessage('')
    try {
      await onSave(await createCroppedAvatar(imageSrc, croppedArea))
      close()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存头像失败，请稍后重试。')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)] max-w-xl">
        <DialogHeader>
          <DialogTitle>编辑头像</DialogTitle>
          <DialogDescription>选择照片并调整构图。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 px-6 py-6">
          <div className="relative h-80 overflow-hidden rounded-md bg-inverse">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, areaPixels) => setCroppedArea(areaPixels)}
              />
            ) : (
              <label className="absolute inset-0 grid cursor-pointer place-items-center text-graphite transition hover:bg-white/5 hover:text-white">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ImagePlus size={18} aria-hidden="true" />
                  选择图片
                </span>
                <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className={`inline-flex h-10 items-center gap-2 rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition ${isSaving ? 'cursor-wait opacity-55' : 'cursor-pointer hover:border-signal hover:text-signal'}`}>
              <ImagePlus size={16} aria-hidden="true" />
              更换图片
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={isSaving} onChange={onFileChange} />
            </label>
            {imageSrc ? (
              <label className="flex min-w-48 flex-1 items-center gap-3 text-sm font-semibold text-graphite">
                <ZoomIn size={16} aria-hidden="true" />
                <input
                  className="h-1.5 min-w-24 flex-1 cursor-pointer appearance-none rounded-full bg-rail accent-signal"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  aria-label="缩放头像"
                />
              </label>
            ) : null}
          </div>

          {message ? <p className="text-sm font-semibold text-clay">{message}</p> : null}

          <div className="flex justify-end gap-3 border-t border-rail pt-5">
            <button type="button" onClick={close} disabled={isSaving} className="inline-flex h-10 items-center rounded-md border border-rail bg-paper px-3 text-sm font-semibold text-ink transition hover:border-graphite/50 disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">取消</button>
            <button type="button" onClick={() => void save()} disabled={!imageSrc || isSaving} className="inline-flex h-10 items-center gap-2 rounded-md bg-signal px-3 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline">
              {isSaving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
              {isSaving ? '保存中' : '保存头像'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
