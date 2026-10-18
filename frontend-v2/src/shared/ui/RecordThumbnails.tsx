import { Images } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { PostImage } from '../model'
import { ImagePreview } from './ImagePreview'

const thumbnailSizes = {
  small: 'size-14',
  large: 'size-36',
}
const previewLimit = 3

/** Shows up to three thumbnails and previews only the clicked image without navigating away. */
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
    <ImagePreview images={images} selectedIndex={selectedIndex} onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }) }} />
  </Dialog.Root>
}
