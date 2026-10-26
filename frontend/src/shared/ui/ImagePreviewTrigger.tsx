import { useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import type { PostImage } from '../model/content'
import { ImagePreview } from './ImagePreview'

/** Opens a single image from a custom trigger and restores focus when dismissed. */
export function ImagePreviewTrigger({ image, children, className = '' }: { image: PostImage; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={`cursor-zoom-in border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${className}`} title={`查看图片：${image.alt}`}>
          {children}
        </button>
      </Dialog.Trigger>
      <ImagePreview images={[image]} selectedIndex={open ? 0 : null} />
    </Dialog.Root>
  )
}
