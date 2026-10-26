import { useState } from 'react'
import type { Project } from '../model/types'
import { getAvatarLabel } from '../../../shared/lib/avatar'

const avatarSizes = {
  compact: 'size-9 rounded-md text-sm',
  small: 'size-10 rounded-md text-base',
  large: 'size-14 rounded-[16px] text-xl',
  card: 'size-12 rounded-xl text-lg',
  header: 'size-[72px] rounded-[16px] text-2xl',
  settings: 'size-16 rounded-[14px] text-xl',
}

/** Graph identity with a title initial whenever no usable custom avatar is set. */
export function ProjectAvatar({ project, size = 'small' }: { project: Pick<Project, 'title' | 'avatar'>; size?: keyof typeof avatarSizes }) {
  const [failedImage, setFailedImage] = useState<string>()
  const image = project.avatar?.trim()
  return (
    <span className={`inline-grid flex-none place-items-center overflow-hidden bg-signal-soft font-bold text-signal ${avatarSizes[size]}`} aria-hidden="true">
      {image && failedImage !== image ? <img className="size-full object-cover" src={image} alt="" onError={() => setFailedImage(image)} /> : getAvatarLabel(project.title, '图')}
    </span>
  )
}
