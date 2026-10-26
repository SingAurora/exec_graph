import { Footprints, MessageCircle, Network, ScrollText } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import type { ProfileSearchScope } from '../../../features/search-profile/model/types'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { getRetainedTabScrollTop } from '../../../shared/lib/tab-scroll'
import { ProfileSearchPanel } from './ProfileSearchPanel'

type Props = Omit<ComponentProps<typeof ProfileSearchPanel>, 'scope'>
const scopes = [
  { value: 'expressions', label: '表达', icon: MessageCircle },
  { value: 'agreements', label: '约定', icon: ScrollText },
  { value: 'actions', label: '行动', icon: Footprints },
  { value: 'graphs', label: '图', icon: Network },
] as const

/** Independent profile search categories with retained criteria, pagination and reading positions. */
export function ProfileSearch({ active, ...props }: Props) {
  const [scope, setScope] = useState<ProfileSearchScope>('expressions')
  const headerRef = useRef<HTMLDivElement>(null)
  const scrollPositions = useRef<Partial<Record<ProfileSearchScope, number>>>({})
  const pendingScroll = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (!active || pendingScroll.current === undefined) return
    const top = pendingScroll.current
    pendingScroll.current = undefined
    window.scrollTo({ top, behavior: 'instant' })
  }, [scope, active])
  const changeScope = (value: string) => {
    const next = value as ProfileSearchScope
    if (next === scope) return
    const currentTop = window.scrollY
    const navigationTop = Math.max(0, currentTop + (headerRef.current?.getBoundingClientRect().top ?? 0) - 48)
    scrollPositions.current[scope] = currentTop
    pendingScroll.current = getRetainedTabScrollTop(scrollPositions.current[next], currentTop, navigationTop)
    setScope(next)
  }
  return (
    <section className="pt-4">
      <TabsRoot value={scope} onValueChange={changeScope}>
        <div ref={headerRef}><TabsList compact showDivider={false}>
          {scopes.filter(({ value }) => value === 'agreements' ? props.references && props.onOpenReference : value !== 'graphs' || props.graphs).map(({ value, label, icon: Icon }) => <TabsTrigger key={value} value={value} compact><span className="inline-flex items-center gap-1.5"><Icon size={14} />{label}</span></TabsTrigger>)}
        </TabsList></div>
        {scopes.map(({ value }) => <TabsContent key={value} value={value} keepMounted><ProfileSearchPanel {...props} scope={value} active={active && scope === value} /></TabsContent>)}
      </TabsRoot>
    </section>
  )
}
