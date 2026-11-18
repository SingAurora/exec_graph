import { EMPTY_BIO_DISPLAY } from '../model/defaults'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import './profile-biography.css'

/** Renders a complete biography or sidebar preview, retaining images but never navigable text links. */
export function ProfileBiography({ biography, compact = false }: { biography: string; compact?: boolean }) {
  if (!biography.trim()) {
    return <p className={'profile-biography profile-biography-placeholder' + (compact ? ' profile-biography-compact' : '')}>{EMPTY_BIO_DISPLAY}</p>
  }
  return (
    <div className={'profile-biography' + (compact ? ' profile-biography-compact' : '')}>
      <MarkdownContent markdown={biography} showImageCaptions={false} allowLinks={false} imageVariant={compact ? 'compact' : 'profile'} />
    </div>
  )
}
