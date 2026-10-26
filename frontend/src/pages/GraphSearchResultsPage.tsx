import type { ComponentProps } from 'react'
import { GraphSearchResults } from '../widgets/graph-search-results/ui/GraphSearchResults'

type Props = Omit<ComponentProps<typeof GraphSearchResults>, 'keyword' | 'page'> & { params: URLSearchParams }

/** 从路由读取已提交的关键词和页码，再交给图搜索结果组件。 */
export function GraphSearchResultsPage({ params, ...props }: Props) {
  const keyword = params.get('query')?.trim() ?? ''
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  return (
    <GraphSearchResults key={keyword} {...props} keyword={keyword} page={page} />
  )
}
