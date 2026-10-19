import { Check, ImagePlus, Minus, Plus } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { getAvatarLabel } from '../../../shared/lib/avatar'
import {
  imageCompressionThreshold,
  readImageFile,
  renderCroppedImage,
} from '../../../shared/lib/image'

const avatarViewportSize = 280
const avatarOutputSize = 512

type AvatarEditorProps = {
  value: string
  fallback: string
  onChange: (avatar: string) => void
}

type ImageSize = { width: number; height: number }
type Offset = { x: number; y: number }
type DragState = { startX: number; startY: number; originX: number; originY: number }

/** Provides local avatar selection, square cropping, zooming, and compression. */
export function AvatarEditor({ value, fallback, onChange }: AvatarEditorProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [sourceSize, setSourceSize] = useState(0)
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })

  const baseScale = naturalSize ? Math.max(avatarViewportSize / naturalSize.width, avatarViewportSize / naturalSize.height) : 1
  const renderScale = baseScale * zoom
  const renderedWidth = (naturalSize?.width ?? avatarViewportSize) * renderScale
  const renderedHeight = (naturalSize?.height ?? avatarViewportSize) * renderScale

  const clampOffset = (next: Offset, scale = renderScale): Offset => {
    const width = (naturalSize?.width ?? avatarViewportSize) * scale
    const height = (naturalSize?.height ?? avatarViewportSize) * scale
    return {
      x: Math.min(0, Math.max(avatarViewportSize - width, next.x)),
      y: Math.min(0, Math.max(avatarViewportSize - height, next.y)),
    }
  }

  const openFilePicker = () => {
    if (inputRef.current) inputRef.current.value = ''
    inputRef.current?.click()
  }

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? []
    if (!file || !file.type.startsWith('image/')) return
    const imageSource = await readImageFile(file)
    setSource(imageSource)
    setSourceSize(file.size)
    setNaturalSize(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setOpen(true)
  }

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    const nextSize = { width: image.naturalWidth, height: image.naturalHeight }
    const nextScale = Math.max(avatarViewportSize / nextSize.width, avatarViewportSize / nextSize.height)
    setNaturalSize(nextSize)
    setOffset({
      x: (avatarViewportSize - nextSize.width * nextScale) / 2,
      y: (avatarViewportSize - nextSize.height * nextScale) / 2,
    })
  }

  const changeZoom = (nextZoom: number) => {
    const previousScale = renderScale
    const nextScale = baseScale * nextZoom
    const ratio = nextScale / previousScale
    setZoom(nextZoom)
    setOffset(clampOffset({
      x: avatarViewportSize / 2 - (avatarViewportSize / 2 - offset.x) * ratio,
      y: avatarViewportSize / 2 - (avatarViewportSize / 2 - offset.y) * ratio,
    }, nextScale))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!naturalSize) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setOffset(clampOffset({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }))
  }

  const finishDrag = () => { dragRef.current = null }

  const closeEditor = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSource('')
      setNaturalSize(null)
    }
  }

  const saveAvatar = () => {
    if (!imageRef.current || !naturalSize) return
    const quality = sourceSize > imageCompressionThreshold ? 0.78 : 0.9
    onChange(renderCroppedImage(imageRef.current, { viewportSize: avatarViewportSize, offsetX: offset.x, offsetY: offset.y, renderScale }, { outputSize: avatarOutputSize, quality }))
    closeEditor(false)
  }

  return <>
    <div className="grid shrink-0 justify-items-start gap-2">
    <button className="group relative grid size-[88px] flex-none place-items-center overflow-hidden rounded-xl border-0 bg-transparent p-0" type="button" onClick={openFilePicker} aria-label="编辑头像">
      <span className={`inline-grid size-[88px] place-items-center overflow-hidden rounded-[11px] bg-signal-soft text-[27px] font-bold text-signal${value ? ' bg-cover bg-center bg-no-repeat' : ''}`} style={value ? { backgroundImage: `url("${value}")` } : undefined}>{value ? '' : getAvatarLabel(fallback)}</span>
      <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><ImagePlus size={20} /><span className="sr-only">编辑头像</span></span>
    </button>
    <input ref={inputRef} id={inputId} className="sr-only" type="file" accept="image/*" onChange={selectImage} />
    {value && <button className="text-button text-xs" type="button" onClick={() => onChange('')}>使用文字头像</button>}
    </div>
    <Dialog open={open} onOpenChange={closeEditor} title="编辑头像" description="调整头像的缩放和裁剪位置" className="w-[min(calc(100%-40px),380px)] rounded-lg p-[26px]">
      <div className="relative mx-auto mt-[22px] size-[280px] cursor-grab touch-none overflow-hidden rounded-[10px] bg-soft active:cursor-grabbing" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
        {source && <img className="absolute max-w-none select-none" ref={imageRef} src={source} alt="头像裁剪预览" draggable={false} onLoad={handleImageLoad} style={{ width: renderedWidth, height: renderedHeight, left: offset.x, top: offset.y }} />}
        <span className="pointer-events-none absolute inset-0 rounded-[10px] border-2 border-white/90 shadow-[0_0_0_999px_rgb(0_0_0_/_0.28)]" />
      </div>
      <div className="mt-[19px] flex items-center gap-2.5 text-muted">
        <Minus size={14} />
        <input className="w-full accent-signal" aria-label="头像缩放" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} />
        <Plus size={14} />
      </div>
      <p className="mt-2.5 text-[11px] leading-[1.5] text-muted">拖动图片调整位置{sourceSize > imageCompressionThreshold ? '，大于 2MB 的图片会自动压缩' : ''}</p>
      <div className="mt-[15px] flex justify-end gap-[9px]"><button className="quiet-button" type="button" onClick={() => closeEditor(false)}>取消</button><button className="primary-button" type="button" onClick={saveAvatar} disabled={!naturalSize}><Check size={15} />使用此头像</button></div>
    </Dialog>
  </>
}
