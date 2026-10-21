import { Dialog } from 'radix-ui'
import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDocumentImages } from '../lib/document-images'
import type { PostImage } from '../model/content'
import { ImagePreview } from './ImagePreview'

/** Reads text and full-ratio images in document order, with a shared image preview. */
export function MarkdownContent({ markdown, images = [], showImageCaptions = true, allowLinks = true }: { markdown: string; images?: PostImage[]; showImageCaptions?: boolean; allowLinks?: boolean }) {
  const document = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLImageElement | null>(null)
  const [preview, setPreview] = useState<{ images: PostImage[]; index: number } | null>(null)

  const openImage = useCallback((image: HTMLImageElement) => {
    const elements = Array.from(document.current?.querySelectorAll('img') ?? [])
    const index = elements.indexOf(image)
    if (index < 0) return
    trigger.current = image
    setPreview({ images: elements.map((element) => ({ url: element.currentSrc || element.src, alt: element.alt })), index })
  }, [])

  const renderImage = useCallback(({ src, alt, title }: ComponentPropsWithoutRef<'img'>) => <span className="record-document-figure">
    <img src={src} alt={alt ?? ''} title={title} loading="lazy" role="button" tabIndex={0} aria-label={`查看图片：${alt || '文档图片'}`}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); openImage(event.currentTarget) }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); openImage(event.currentTarget) } }} />
    {showImageCaptions && alt && <span className="record-document-caption">{alt}</span>}
  </span>, [openImage, showImageCaptions])

  return <Dialog.Root open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
    <div className="record-markdown" ref={document}>
      <ReactMarkdown remarkPlugins={[remarkGfm, [remarkDocumentImages, { images }]]} disallowedElements={allowLinks ? undefined : ['a']} unwrapDisallowed components={{ img: renderImage }}>{markdown}</ReactMarkdown>
    </div>
    <ImagePreview images={preview?.images ?? []} selectedIndex={preview?.index ?? null}
      onSelectImage={(index) => setPreview((current) => current ? { ...current, index } : null)}
      onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }) }} />
  </Dialog.Root>
}
