import type { ComponentProps } from 'react'
import { Following } from '../widgets/following/ui/Following'

/** Composes followed activity and object directories. */
export function FollowingPage(props: ComponentProps<typeof Following>) {
  return <Following {...props} />
}
