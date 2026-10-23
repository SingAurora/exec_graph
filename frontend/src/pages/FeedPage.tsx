import type { ComponentProps } from 'react'
import { Discovery } from '../widgets/discovery/ui/Discovery'

/** 发现页只装配内容区；表达流、约定回应和搜索交互由 Discovery 负责。 */
export function FeedPage(props: ComponentProps<typeof Discovery>) {
  return <Discovery {...props} />
}
