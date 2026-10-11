import { useEffect, useState } from 'react'
import type { Action, AuthView, CompletionRecord, DiscoveryPost, UserProfile } from '../shared/model'
import { isAppView, isAuthView, useHashRoute } from '../shared/lib/navigation'
import { MyPage } from '../pages/MyPage'
import { AuthScreen } from '../widgets/auth/AuthScreen'
import { CompletionModal } from '../widgets/actions/CompletionModal'
import { DiscoveryPage } from '../widgets/discovery/CompletionFeed'
import { SettingsPanel } from '../widgets/settings/SettingsPanel'
import { AppShell } from '../widgets/layout/AppShell'

const initialProfile: UserProfile = { name: '乔', email: 'qiao@example.com', gender: 'unknown', bio: '把想法变成正在发生的事情。', avatar: '' }
const initialActions: Action[] = [
  { id: 'bath', title: '洗澡', description: '认真洗干净，洗完让自己舒服地进入下一个状态。', points: ['重点部位洗到', '身体擦干', '用品归位'], createdAt: '今天 18:42' },
  { id: 'reading', title: '读完《思考，快与慢》第三章', description: '用半小时读完这一章，记下一个真正改变自己理解的观点。', points: ['读完第三章', '记下一条自己的理解'], createdAt: '今天 09:10' },
]
const initialRecords: CompletionRecord[] = [
  { id: 'desk', title: '整理书桌', note: '清掉桌面和地上的杂物，留下了明天要用的东西。', day: '08', month: '10月' },
  { id: 'breakfast', title: '准备明天的早餐', note: '提前洗好水果，准备了鸡蛋和面包，早上不用再犹豫。', day: '07', month: '10月' },
]
const initialPosts: DiscoveryPost[] = [
  { id: 'bread', name: '林岚', avatar: '林', avatarTone: 'blue', time: '今天 09:20', title: '第一次做出完整的酸面包', note: '从准备酵头到烤完出炉，第一次把整个过程做完了。下次想把发酵时间记得更准确。', following: true },
  { id: 'balcony', name: 'miao', avatar: 'M', avatarTone: 'coral', time: '昨天 21:08', title: '把阳台收拾成可以坐下来的地方', note: '清掉了不用的箱子，擦干净地面，留下了一把椅子和一盏灯，晚上终于愿意坐在那里了。', following: false },
]

export function App() {
  const [route, navigate] = useHashRoute('home', isAppView)
  const authRoute = useAuthRoute()
  const [profile, setProfile] = useState(initialProfile)
  const [actions, setActions] = useState(initialActions)
  const [records, setRecords] = useState(initialRecords)
  const [posts, setPosts] = useState(initialPosts)
  const [darkMode, setDarkMode] = useState(false)
  const [completing, setCompleting] = useState<Action | null>(null)

  useEffect(() => { document.documentElement.toggleAttribute('data-theme', darkMode) }, [darkMode])
  useEffect(() => { window.scrollTo(0, 0) }, [route, authRoute])

  if (authRoute) return <AuthScreen view={authRoute} onEnter={() => { window.location.hash = 'home' }} />

  const saveCompletion = (note: string) => {
    if (!completing) return
    setActions((current) => current.filter((action) => action.id !== completing.id))
    setRecords((current) => [{ id: `record-${Date.now()}`, title: completing.title, note, day: '10', month: '10月' }, ...current])
    setCompleting(null)
    navigate('records')
  }

  const toggleFollow = (id: string) => setPosts((current) => current.map((post) => post.id === id ? { ...post, following: !post.following } : post))

  return <AppShell profile={profile} activeView={route} onLogout={() => { window.location.hash = 'login' }}>
    {['home', 'today', 'actions', 'records', 'following'].includes(route) && <MyPage view={route} profile={profile} actions={actions} records={records} posts={posts} onNavigate={navigate} onCreate={(action) => setActions((current) => [action, ...current])} onComplete={setCompleting} onToggleFollow={toggleFollow} />}
    {route === 'people' && <DiscoveryPage posts={posts} onToggleFollow={toggleFollow} />}
    {route === 'settings' && <SettingsPanel profile={profile} darkMode={darkMode} onSave={setProfile} onToggleTheme={() => setDarkMode((current) => !current)} />}
    <CompletionModal action={completing} onClose={() => setCompleting(null)} onSave={saveCompletion} />
  </AppShell>
}

function useAuthRoute() {
  const [route, setRoute] = useState<AuthView | null>(() => {
    const value = window.location.hash.slice(1)
    return isAuthView(value) ? value : null
  })
  useEffect(() => {
    const handleHashChange = () => { const value = window.location.hash.slice(1); setRoute(isAuthView(value) ? value : null) }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])
  return route
}
