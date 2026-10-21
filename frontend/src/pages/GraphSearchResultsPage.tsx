import type { ComponentProps } from 'react'
import { GraphSearchResults } from '../widgets/graph-search-results/ui/GraphSearchResults'

type Props = Omit<ComponentProps<typeof GraphSearchResults>, 'keyword' | 'page'> & { params: URLSearchParams }

/** Reads graph search parameters and composes the full result list. */
export function GraphSearchResultsPage({ params, ...props }: Props) {
  const keyword = params.get('query')?.trim() ?? ''
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  return <GraphSearchResults key={keyword} {...props} keyword={keyword} page={page} />
}
