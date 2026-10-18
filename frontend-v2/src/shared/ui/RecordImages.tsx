import { Dialog } from 'radix-ui'
import { useState } from 'react'
import type { PostImage } from '../model'
import { ImagePreview } from './ImagePreview'

/** Record images open at their natural ratio; absent images occupy no space. */
export function RecordImages({ images, showCaptions = true }: { images: PostImage[]; showCaptions?: boolean }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  if (!images.length) return null
  return <Dialog.Root open={selectedIndex !== null} onOpenChange={(open) => { if (!open) setSelectedIndex(null) }}>
    <div className={`mt-6 grid gap-3 ${images.length > 1 ? 'grid-cols-2' : ''}`}>
      {images.map((image, index) => <Dialog.Trigger asChild key={`${image.url}-${index}`}><button type="button" className="cursor-zoom-in overflow-hidden rounded-md border-0 bg-soft p-0 text-left" onClick={() => setSelectedIndex(index)} aria-label={`查看图片：${image.alt}`}><img className="aspect-[16/10] w-full object-cover transition hover:opacity-90" src={image.url} alt={image.alt} loading="lazy" />{showCaptions && <span className="block px-3 py-2 text-xs text-muted">{image.alt}</span>}</button></Dialog.Trigger>)}
    </div>
    <ImagePreview images={images} selectedIndex={selectedIndex} onSelectImage={setSelectedIndex} />
  </Dialog.Root>
}
