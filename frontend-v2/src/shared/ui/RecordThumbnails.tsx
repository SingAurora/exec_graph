import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { PostImage } from '../model'

const thumbnailSizes = {
  small: 'size-14',
  large: 'size-36',
}
const previewLimit = 3

/** Shows up to three thumbnails and opens the full image collection without navigating away. */
export function RecordThumbnails({ images, size = 'large' }: { images: PostImage[]; size?: keyof typeof thumbnailSizes }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  if (!images.length) return null
  const selected = selectedIndex === null ? undefined : images[selectedIndex]
  const remaining = images.length - previewLimit
  return <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedIndex(null) }}>
    <div className="mt-3 flex gap-2">
    {images.slice(0, previewLimit).map((image, index) => <button type="button" className={`pointer-events-auto relative z-10 flex-none cursor-zoom-in overflow-hidden rounded-md border border-line p-0 transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${thumbnailSizes[size]}`} key={`${image.url}-${index}`} aria-label={`查看图片：${image.alt}`} onClick={(event) => { event.stopPropagation(); triggerRef.current = event.currentTarget; setSelectedIndex(index) }}>
      <img className="size-full object-cover" src={image.url} alt={image.alt} loading="lazy" />
      {index === previewLimit - 1 && remaining > 0 && <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-medium leading-4 tabular-nums text-white shadow-sm ring-1 ring-white/15 backdrop-blur-sm" aria-label={`还有 ${remaining} 张图片`}><Images size={12} aria-hidden="true" />+{remaining}</span>}
    </button>)}
    </div>
    <Dialog.Portal>
      <Dialog.Overlay className="pointer-events-auto fixed inset-0 z-40 bg-black/65" />
      <Dialog.Content className="pointer-events-auto fixed left-1/2 top-1/2 z-50 w-[min(960px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-4 text-ink shadow-app" onClick={(event) => event.stopPropagation()} onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }) }}>
        <Dialog.Title className="mb-3 pr-10 text-sm">{selected?.alt}</Dialog.Title>
        <Dialog.Description className="sr-only">查看附图大图</Dialog.Description>
        <Dialog.Close className="icon-button absolute right-3 top-3" aria-label="关闭图片"><X size={16} /></Dialog.Close>
        {selected && <img src={selected.url} alt={selected.alt} className="max-h-[72vh] w-full object-contain" />}
        {images.length > 1 && <div className="mt-3 flex items-center justify-center gap-4">
          <button type="button" className="icon-button" disabled={selectedIndex === 0} aria-label="上一张图片" onClick={() => setSelectedIndex((index) => index === null ? null : Math.max(0, index - 1))}><ChevronLeft size={18} /></button>
          <span className="text-xs tabular-nums text-muted" aria-live="polite">{(selectedIndex ?? 0) + 1} / {images.length}</span>
          <button type="button" className="icon-button" disabled={selectedIndex === images.length - 1} aria-label="下一张图片" onClick={() => setSelectedIndex((index) => index === null ? null : Math.min(images.length - 1, index + 1))}><ChevronRight size={18} /></button>
        </div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
