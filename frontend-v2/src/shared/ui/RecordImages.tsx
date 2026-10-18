import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useState } from 'react'
import type { PostImage } from '../model'

/** Record images open at their natural ratio; absent images occupy no space. */
export function RecordImages({ images }: { images: PostImage[] }) {
  const [selected, setSelected] = useState<PostImage>()
  if (!images.length) return null
  return <Dialog.Root open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(undefined) }}>
    <div className={`mt-6 grid gap-3 ${images.length > 1 ? 'grid-cols-2' : ''}`}>
      {images.map((image, index) => <Dialog.Trigger asChild key={`${image.url}-${index}`}><button type="button" className="overflow-hidden rounded-md border border-line bg-soft text-left" onClick={() => setSelected(image)} aria-label={`查看图片：${image.alt}`}><img className="aspect-[16/10] w-full object-cover transition hover:opacity-90" src={image.url} alt={image.alt} loading="lazy" /><span className="block px-3 py-2 text-xs text-muted">{image.alt}</span></button></Dialog.Trigger>)}
    </div>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-40 bg-black/65" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(960px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-4 shadow-app"><Dialog.Title className="mb-3 pr-10 text-sm">{selected?.alt}</Dialog.Title><Dialog.Description className="sr-only">行动记录附图</Dialog.Description><Dialog.Close className="icon-button absolute right-3 top-3" aria-label="关闭图片"><X size={16} /></Dialog.Close>{selected && <img src={selected.url} alt={selected.alt} className="max-h-[78vh] w-full object-contain" />}</Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
