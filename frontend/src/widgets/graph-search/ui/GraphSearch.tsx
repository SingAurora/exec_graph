import { Footprints, MessageCircle, ScrollText, UsersRound } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { getReferenceAgreementAuthorId } from '../../../entities/action/lib/agreement-responses'
import { getActionReferences } from '../../../entities/action/lib/references'
import type { GraphSearchScope } from '../../../features/search-graph/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { GraphSearchPanel } from './GraphSearchPanel'

type Props = Omit<ComponentProps<typeof GraphSearchPanel>, 'scope' | 'filterUsers'>
const scopes = [
  { value: 'expressions', label: '表达', icon: MessageCircle },
  { value: 'agreements', label: '约定', icon: ScrollText },
  { value: 'actions', label: '行动', icon: Footprints },
  { value: 'users', label: '用户', icon: UsersRound },
] as const

/** Keeps four independent search panels mounted and restores each category's reading position. */
export function GraphSearch({ active, ...props }: Props) {
  const [scope, setScope] = useState<GraphSearchScope>('expressions')
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollPositions = useRef<Partial<Record<GraphSearchScope, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  const filterUsers = useMemo(() => {
    const authors = new Set(props.actions.filter((node) => node.projectId === props.projectId).map((node) => node.authorId))
    const unique = new Map(props.users.filter((user) => authors.has(user.id)).map((user) => [user.id, user]))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [props.actions, props.users, props.projectId])
  const agreementUsers = useMemo(() => {
    const authors = new Set(getActionReferences(props.actions.filter((node) => node.projectId === props.projectId))
      .flatMap((reference) => [getReferenceAgreementAuthorId(reference), reference.target.authorId]))
    const unique = new Map([...filterUsers, ...props.users.filter((user) => authors.has(user.id))].map((user) => [user.id, user]))
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [filterUsers, props.actions, props.users, props.projectId])

  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    const frame = requestAnimationFrame(() => window.scrollTo({ top, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [scope, active])

  const switchScope = (next: GraphSearchScope) => {
    if (next === scope) return
    scrollPositions.current[scope] = window.scrollY
    pendingScroll.current = scrollPositions.current[next] ?? Math.max(0, window.scrollY + (headerRef.current?.getBoundingClientRect().top ?? 0) - 44)
    setScope(next)
  }

  return (
    <section className="min-w-0" aria-label="图内搜索结果">
      <TabsRoot value={scope} onValueChange={(value) => switchScope(value as GraphSearchScope)}>
        <div ref={headerRef}><TabsList label="搜索分类" compact showDivider={false}>
          {scopes.map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} compact><span className="inline-flex items-center gap-1.5"><Icon size={14} />{label}</span></TabsTrigger>)}
        </TabsList></div>
        {scopes.map(({ value }) => <TabsContent key={value} value={value} keepMounted>
          <GraphSearchPanel {...props} active={active && scope === value} scope={value} filterUsers={value === 'agreements' ? agreementUsers : filterUsers} />
        </TabsContent>)}
      </TabsRoot>
    </section>
  )
}
