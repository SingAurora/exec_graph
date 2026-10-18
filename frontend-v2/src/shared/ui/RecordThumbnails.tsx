import { Images } from 'lucide-react'
import type { PostImage } from '../model'

const thumbnailSizes = {
  small: 'size-14',
  large: 'size-36',
}
const previewLimit = 3

/** Shows up to three record thumbnails, with the remaining count on the last image. */
export function RecordThumbnails({ images, size = 'large' }: { images: PostImage[]; size?: keyof typeof thumbnailSizes }) {
  if (!images.length) return null
  const remaining = images.length - previewLimit
  return <div className="mt-3 flex gap-2">
    {images.slice(0, previewLimit).map((image, index) => <span className={`relative flex-none overflow-hidden rounded-md border border-line ${thumbnailSizes[size]}`} key={`${image.url}-${index}`}>
      <img className="size-full object-cover" src={image.url} alt={image.alt} loading="lazy" />
      {index === previewLimit - 1 && remaining > 0 && <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 text-xs font-medium leading-4 tabular-nums text-white shadow-sm ring-1 ring-white/15 backdrop-blur-sm" aria-label={`还有 ${remaining} 张图片`}><Images size={12} aria-hidden="true" />+{remaining}</span>}
    </span>)}
  </div>
}
