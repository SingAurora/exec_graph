import { Dialog } from 'radix-ui'
import { ImageOff } from 'lucide-react'
import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkDocumentImages, resolveAssetImageUrls } from '../lib/document-images'
import type { PostImage } from '../model/content'
import { ImagePreview } from './ImagePreview'

/** Reads text and full-ratio images in document order, with a shared image preview. */
function MarkdownImage({ src, alt, title, onOpen, showCaption }: {
  src?: string
  alt?: string
  title?: string
  onOpen: (image: HTMLImageElement) => void
  showCaption: boolean
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  if (status === 'error') {
    return (
      <span className="record-document-figure record-document-figure-error" title={`图片无法加载：${alt || src || '未知地址'}`}>
        <ImageOff size={20} />
        <span className="record-document-error-hint">链接可能失效或被网站限制</span>
      </span>
    )
  }
  return (
    <span className={status === 'loading' ? 'record-document-figure record-document-figure-loading' : 'record-document-figure'}>
      {status === 'loading' && <span className="record-document-loading" />}
      <img src={src} alt={alt ?? ''} title={title ?? `查看图片：${alt || '文档图片'}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" tabIndex={0}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); onOpen(event.currentTarget) }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onOpen(event.currentTarget) } }} />
      {showCaption && alt && <span className="record-document-caption">{alt}</span>}
    </span>
  )
}

export function MarkdownContent({ markdown, images = [], showImageCaptions = true, allowLinks = true, imageVariant = 'document', className = '' }: { markdown: string; images?: PostImage[]; showImageCaptions?: boolean; allowLinks?: boolean; imageVariant?: 'document' | 'profile' | 'compact'; className?: string }) {
  const document = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLImageElement | null>(null)
  const [preview, setPreview] = useState<{ images: PostImage[]; index: number } | null>(null)

  const source = resolveAssetImageUrls(markdown, images)
  const openImage = useCallback((image: HTMLImageElement) => {
    const elements = Array.from(document.current?.querySelectorAll('img') ?? [])
    const index = elements.indexOf(image)
    if (index < 0) return
    trigger.current = image
    setPreview({ images: elements.map((element) => ({ url: element.currentSrc || element.src, alt: element.alt })), index })
  }, [])

  const renderImage = useCallback(({ src, alt, title }: ComponentPropsWithoutRef<'img'>) => <MarkdownImage src={src} alt={alt} title={title} onOpen={openImage} showCaption={showImageCaptions} />, [openImage, showImageCaptions])

  return (
    <Dialog.Root open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
      <div className={`record-markdown record-markdown-${imageVariant} ${className}`.trim()} ref={document}>
        <ReactMarkdown remarkPlugins={[remarkGfm, [remarkDocumentImages, { images }]]} disallowedElements={allowLinks ? undefined : ['a']} unwrapDisallowed components={{ img: renderImage }}>{source}</ReactMarkdown>
      </div>
      <ImagePreview images={preview?.images ?? []} selectedIndex={preview?.index ?? null}
        onSelectImage={(index) => setPreview((current) => current ? { ...current, index } : null)}
        onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }) }} />
    </Dialog.Root>
  )
}
