import type { PostImage } from '../model/content'
import { MarkdownContent } from './MarkdownContent'

/** Record images open at their natural ratio; absent images occupy no space. */
export function RecordImages({ images, showCaptions = true }: { images: PostImage[]; showCaptions?: boolean }) {
  if (!images.length) return null
  return <div className="mt-6"><MarkdownContent markdown="" images={images} showImageCaptions={showCaptions} /></div>
}
