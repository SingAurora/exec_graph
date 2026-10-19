import type { ComponentProps } from 'react'
import { Discovery } from '../widgets/discovery/ui/Discovery'

/** Composes discovery of public expressions, agreement exchanges, actions and graphs. */
export function FeedPage(props: ComponentProps<typeof Discovery>) {
  return <Discovery {...props} />
}
