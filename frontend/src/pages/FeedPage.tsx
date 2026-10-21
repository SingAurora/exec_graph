import type { ComponentProps } from 'react'
import { Discovery } from '../widgets/discovery/ui/Discovery'

/** Composes discovery of expressions and agreement exchanges with auxiliary graph search. */
export function FeedPage(props: ComponentProps<typeof Discovery>) {
  return <Discovery {...props} />
}
