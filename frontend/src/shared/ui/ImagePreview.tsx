import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ComponentPropsWithoutRef } from 'react'
import type { PostImage } from '../model/content'
import { ImageDownloadButton } from './ImageDownloadButton'

type ImagePreviewProps = {
  images: PostImage[]
  selectedIndex: number | null
  onSelectImage?: (index: number) => void
  onCloseAutoFocus?: ComponentPropsWithoutRef<typeof Dialog.Content>['onCloseAutoFocus']
}

/** Shared lightbox; image navigation is enabled only when a selection callback is provided. */
export function ImagePreview({ images, selectedIndex, onSelectImage, onCloseAutoFocus }: ImagePreviewProps) {
  const selected = selectedIndex === null ? undefined : images[selectedIndex]
  if (!selected) return null
  const canNavigate = Boolean(onSelectImage && images.length > 1)

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="pointer-events-auto fixed inset-0 z-40 bg-black/65" />
      <Dialog.Content className="pointer-events-auto fixed left-1/2 top-1/2 z-50 w-[min(960px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-4 text-ink shadow-app" onClick={(event) => event.stopPropagation()} onCloseAutoFocus={onCloseAutoFocus}>
        <Dialog.Description className="sr-only">查看附图大图</Dialog.Description>
        <img src={selected.url} alt={selected.alt} className={`${canNavigate ? 'max-h-[72vh]' : 'max-h-[78vh]'} w-full object-contain`} />
        <div className={`mt-3 ${canNavigate ? '' : 'flex items-center justify-between gap-4'}`}>
          <Dialog.Title className="text-sm font-normal leading-6 text-muted">{selected.alt}</Dialog.Title>
          {!canNavigate && <ImageDownloadButton image={selected} />}
        </div>
        {canNavigate && <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="col-start-2 flex items-center justify-center gap-4">
            <button type="button" className="icon-button" disabled={selectedIndex === 0} aria-label="上一张图片" onClick={() => onSelectImage?.(Math.max(0, (selectedIndex ?? 0) - 1))}><ChevronLeft size={18} /></button>
            <span className="text-xs tabular-nums text-muted" aria-live="polite">{(selectedIndex ?? 0) + 1} / {images.length}</span>
            <button type="button" className="icon-button" disabled={selectedIndex === images.length - 1} aria-label="下一张图片" onClick={() => onSelectImage?.(Math.min(images.length - 1, (selectedIndex ?? 0) + 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="col-start-3 justify-self-end"><ImageDownloadButton image={selected} /></div>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
