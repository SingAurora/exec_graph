import type { ComponentProps } from 'react'
import { Following } from '../widgets/following/ui/Following'

/** 关注页装配关注动态和用户／图目录，具体 Tab 和阅读状态由 Following 保留。 */
export function FollowingPage(props: ComponentProps<typeof Following>) {
  return <Following {...props} />
}
