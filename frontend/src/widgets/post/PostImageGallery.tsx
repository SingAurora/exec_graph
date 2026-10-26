import type { PostImage } from '../../shared/model/content'

type PostImageGalleryProps = {
  images?: PostImage[]
}

export function PostImageGallery({ images }: PostImageGalleryProps) {
  if (!images?.length) return null

  return (
    <div className={`mt-4 grid gap-2.5 ${images.length > 1 ? 'grid-cols-2 max-[520px]:grid-cols-1' : ''}`}><div className="contents">{images.map((image) => <img className="aspect-[16/10] w-full rounded-md border border-line object-cover" key={image.url} src={image.url} alt={image.alt} loading="lazy" />)}</div></div>
  )
}
