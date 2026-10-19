import type { ComponentProps } from 'react'
import { ActivityFeed } from '../widgets/feed/ActivityFeed'

/** Composes public or followed-author activity using the same reading model. */
export function FeedPage(props: ComponentProps<typeof ActivityFeed>) {
  return <ActivityFeed {...props} />
}
