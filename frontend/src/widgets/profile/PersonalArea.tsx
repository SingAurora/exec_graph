import { LayoutDashboard, UserRound } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../shared/ui/tabs/Tabs'
import { PersonalWorkspace } from './PersonalWorkspace'

type PersonalAreaProps = ComponentProps<typeof PersonalWorkspace> & {
  selectedTab: 'overview' | 'profile'
  showNavigation: boolean
  active: boolean
  onSelectTab: (tab: 'overview' | 'profile') => void
  profileContent: ReactNode
}

/** Shares one public profile between its personal tab and visits from author avatars. */
export function PersonalArea({ selectedTab, showNavigation, active, onSelectTab, profileContent, ...overviewProps }: PersonalAreaProps) {
  return (
    <TabsRoot value={selectedTab} onValueChange={(value) => onSelectTab(value as 'overview' | 'profile')}>
      <div hidden={!showNavigation}>
        <TabsList label="我的页面" showDivider={false}>
          <TabsTrigger value="overview"><span className="inline-flex items-center gap-1.5"><LayoutDashboard size={16} />总览</span></TabsTrigger>
          <TabsTrigger value="profile"><span className="inline-flex items-center gap-1.5"><UserRound size={16} />主页</span></TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="overview" keepMounted><PersonalWorkspace {...overviewProps} /></TabsContent>
      <TabsContent value="profile" keepMounted><div hidden={!active || selectedTab !== 'profile'}>{profileContent}</div></TabsContent>
    </TabsRoot>
  )
}
