import { Check, Minus, Plus } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { Dialog } from '../dialog/Dialog'
import { getCropLayout, moveCropPosition, zoomCropPosition, type CropPosition, type ImageDimensions } from '../../lib/image-crop'
import { imageCompressionThreshold, renderRectangularCroppedImage } from '../../lib/image'

export type ImageCropSource = { url: string; size: number }

type ImageCropDialogProps = {
  open: boolean
  image?: ImageCropSource
  variant: 'avatar' | 'cover'
  onOpenChange: (open: boolean) => void
  onConfirm: (image: string) => void
}

const cropFormats = {
  avatar: { title: '编辑头像', previewWidth: 280, outputWidth: 512, outputHeight: 512, submit: '使用此头像', dialogClass: 'w-[min(calc(100%-40px),380px)]' },
  cover: { title: '编辑主页背景', previewWidth: 640, outputWidth: 1600, outputHeight: 320, submit: '使用此背景', dialogClass: 'w-[min(calc(100%-40px),696px)]' },
}

/** Shared crop dialog with fixed avatar and profile-cover formats. */
export function ImageCropDialog({ open, image, variant, onOpenChange, onConfirm }: ImageCropDialogProps) {
  const format = cropFormats[variant]
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={format.title} description="拖动图片调整位置，或使用滑块缩放" className={`${format.dialogClass} rounded-lg p-[26px]`}>
      {image && <ImageCropEditor key={image.url} image={image} format={format} onCancel={() => onOpenChange(false)} onConfirm={(value) => { onConfirm(value); onOpenChange(false) }} />}
    </Dialog>
  )
}

function ImageCropEditor({ image, format, onCancel, onConfirm }: {
  image: ImageCropSource
  format: typeof cropFormats.avatar
  onCancel: () => void
  onConfirm: (image: string) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ x: number; y: number; position: CropPosition } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(format.previewWidth)
  const [naturalSize, setNaturalSize] = useState<ImageDimensions>()
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<CropPosition>({ x: .5, y: .5 })
  const [error, setError] = useState('')
  const viewport = { width: viewportWidth, height: viewportWidth * format.outputHeight / format.outputWidth }
  const layout = getCropLayout(naturalSize ?? viewport, viewport, zoom, position)

  useLayoutEffect(() => {
    const node = viewportRef.current
    if (!node) return
    const updateWidth = () => setViewportWidth(node.getBoundingClientRect().width)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const changeZoom = (value: number) => {
    if (!naturalSize) return
    const nextZoom = Math.max(1, Math.min(3, value))
    setPosition(zoomCropPosition(naturalSize, viewport, zoom, nextZoom, position))
    setZoom(nextZoom)
  }
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, position }
  }
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const origin = dragRef.current
    if (!origin) return
    setPosition(moveCropPosition(layout, origin.position, { x: event.clientX - origin.x, y: event.clientY - origin.y }))
  }
  const finishDrag = () => { dragRef.current = null }
  const save = () => {
    if (!imageRef.current || !naturalSize) return
    try {
      const result = renderRectangularCroppedImage(imageRef.current, {
        viewportWidth: viewport.width, viewportHeight: viewport.height,
        offsetX: layout.offsetX, offsetY: layout.offsetY, renderScale: layout.scale,
      }, {
        outputWidth: format.outputWidth, outputHeight: format.outputHeight,
        quality: image.size > imageCompressionThreshold ? .78 : .88,
      })
      onConfirm(result)
    } catch {
      setError('图片处理失败，请重新选择图片')
    }
  }

  return (
    <>
      <div ref={viewportRef} className="relative mx-auto mt-[22px] w-full cursor-grab touch-none overflow-hidden rounded-lg bg-soft active:cursor-grabbing"
        style={{ maxWidth: format.previewWidth, aspectRatio: `${format.outputWidth} / ${format.outputHeight}` }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!naturalSize) return
          const directions: Record<string, CropPosition> = { ArrowLeft: { x: -8, y: 0 }, ArrowRight: { x: 8, y: 0 }, ArrowUp: { x: 0, y: -8 }, ArrowDown: { x: 0, y: 8 } }
          const delta = directions[event.key]
          if (!delta) return
          event.preventDefault()
          setPosition(moveCropPosition(layout, position, delta))
        }}
        onPointerDown={startDrag} onPointerMove={drag} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
        <img ref={imageRef} className="absolute max-w-none select-none" src={image.url} alt="裁剪预览" draggable={false}
          onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => { setNaturalSize(undefined); setError('图片无法读取，请选择其他图片') }}
          style={{ width: layout.width, height: layout.height, left: layout.offsetX, top: layout.offsetY }} />
        <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-white/70" />
      </div>
      <div className="mt-[19px] flex items-center gap-2.5 text-muted">
        <button className="inline-grid size-8 shrink-0 place-items-center rounded-md border-0 bg-transparent hover:bg-soft hover:text-signal disabled:opacity-40" type="button" title="缩小图片" onClick={() => changeZoom(zoom - .1)} disabled={!naturalSize || zoom <= 1}><Minus size={16} /></button>
        <input className="min-w-0 flex-1 accent-signal" title="图片缩放" type="range" min="1" max="3" step="0.01" value={zoom} disabled={!naturalSize} onChange={(event) => changeZoom(Number(event.target.value))} />
        <button className="inline-grid size-8 shrink-0 place-items-center rounded-md border-0 bg-transparent hover:bg-soft hover:text-signal disabled:opacity-40" type="button" title="放大图片" onClick={() => changeZoom(zoom + .1)} disabled={!naturalSize || zoom >= 3}><Plus size={16} /></button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">拖动图片调整位置，保存时自动压缩</p>
      {error && <p className="mt-2 text-xs text-coral">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button className="quiet-button" type="button" onClick={onCancel}>取消</button><button className="primary-button" type="button" onClick={save} disabled={!naturalSize}><Check size={15} />{format.submit}</button></div>
    </>
  )
}
