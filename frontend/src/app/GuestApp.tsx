import { useState } from 'react'
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react'
import { isAppView, useHashRoute } from '../shared/lib/navigation'
import { AppBackdrop } from '../widgets/layout/AppBackdrop'
import { Brand } from '../shared/ui/Brand'
import { GraphDirectory } from '../widgets/graphs/GraphDirectory'
import { GraphPage } from '../pages/GraphPage'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
import type { VersionedAction } from '../entities/action/api/context'
import type { GraphView } from '../entities/graph/api/graphs'
import type { UserProfile } from '../entities/profile/model/types'

type GuestAppProps = {
  graphs: GraphView[]
  actions: VersionedAction[]
  users: UserProfile[]
  darkMode: boolean
  onToggleTheme: () => void
}

/** 未登录入口：公开目录和行动图可读，任何写操作都引导登录。 */
export function GuestApp({ graphs, actions, users, darkMode, onToggleTheme }: GuestAppProps) {
  const [route, navigate] = useHashRoute('graphs', isAppView)
  const [graphBackground] = useGraphBackground()
  const [lastGraphUuid] = useState(() => graphs[0]?.uuid ?? '')
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const selectedGraph = route === 'graph'
    ? graphs.find((graph) => graph.uuid === (query.get('graphUuid') ?? lastGraphUuid))
    : undefined
  const selectedActions = selectedGraph ? actions.filter((action) => action.graphUuid === selectedGraph.uuid) : []
  const login = () => { window.location.hash = 'login' }
  const register = () => { window.location.hash = 'register' }

  return (
    <div className="relative isolate mx-auto min-h-screen w-[min(1200px,calc(100%-72px))] pt-[30px] max-[1000px]:w-[min(920px,calc(100%-48px))]">
      <AppBackdrop />
      <header className="flex min-h-[66px] items-center justify-between gap-4 border-b border-line">
        <a className="inline-flex w-max rounded-sm" href="#graphs" title="引序 公开行动图"><Brand /></a>
        <div className="flex items-center gap-2">
          <button className="quiet-button" type="button" onClick={onToggleTheme} title={darkMode ? '切换浅色模式' : '切换深色模式'}>
            {darkMode ? '浅色' : '深色'}
          </button>
          <button className="quiet-button" type="button" onClick={login} title="登录引序"><LogIn size={15} />登录</button>
          <button className="primary-button" type="button" onClick={register} title="创建引序账号"><UserPlus size={15} />注册</button>
        </div>
      </header>
      {selectedGraph ? (
        <main className="pb-20">
          <div className="pt-5"><button className="quiet-button" type="button" onClick={() => navigate('graphs')}><ArrowLeft size={15} />返回公开图目录</button></div>
          <GraphPage
            graph={selectedGraph}
            currentUserUuid=""
            users={users}
            actions={selectedActions}
            showActionGraphLegend={false}
            graphBackground={graphBackground}
            onCreateAction={login}
            onContinueAction={login}
            onOpenActionArchive={login}
            onUpdateGraph={() => undefined}
            onEditExpression={login}
            onEditAgreement={login}
            onPublishNodeDocument={async () => { login() }}
            onDeleteNode={async () => { login() }}
            onDeleteGraph={() => { login(); return false }}
            following={false}
            onSetGraphFollow={() => { login(); return false }}
          />
        </main>
      ) : (
        <main className="pb-20">
          <section className="pt-10">
            <p className="text-xs font-semibold tracking-[0.18em] text-signal">公开浏览</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">先看看大家在做什么</h1>
            <p className="mt-3 max-w-[620px] text-sm leading-7 text-copy">这里展示公开的游戏行动图。浏览不需要登录；记录自己的行动、回应约定或参与讨论时，再登录即可。</p>
          </section>
          <div className="mt-8">
            <GraphDirectory
              readOnly
              currentUserUuid=""
              graphs={graphs}
              actions={actions}
              onCreateGraph={login}
              onOpenGraph={(graphUuid: string) => { window.location.hash = 'graph?graphUuid=' + encodeURIComponent(graphUuid) }}
            />
          </div>
        </main>
      )}
    </div>
  )
}
