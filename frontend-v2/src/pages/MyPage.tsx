import type { ComponentProps } from 'react'
import { PersonalArea } from '../widgets/profile/PersonalArea'

/** Composes the overview and the shared public profile selected by the route. */
export function MyPage(props: ComponentProps<typeof PersonalArea>) {
  return <PersonalArea {...props} />
}
