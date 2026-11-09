import { ArrowLeft, LogIn } from 'lucide-react'
import { isAppView, useHashRoute } from '../shared/lib/navigation'
import { AppBackdrop } from '../widgets/layout/AppBackdrop'
import { Brand } from '../shared/ui/Brand'
import { Discovery } from '../widgets/discovery/ui/Discovery'
import { GraphPage } from '../pages/GraphPage'
import { useGraphBackground } from '../features/graph-appearance/model/useGraphBackground'
import type { ActionDocumentMode, ActionNode } from '../entities/action/model/types'
import type { ActionReference } from '../entities/action/lib/references'
import { useGraphContext } from './model/useGraphContext'

type GuestAppProps = { remoteFeed?: boolean }

/** 未登录入口：只读浏览公开表达和约定，任何写操作都引导登录。 */
export function GuestApp({ remoteFeed = false }: GuestAppProps) {
  const [route, navigate] = useHashRoute('home', isAppView)
  const [graphBackground] = useGraphBackground()
  const query = new URLSearchParams(window.location.hash.split('?')[1])
  const graphUuid = query.get('graphUuid') ?? ''
  const { graph: selectedGraph, actions: selectedActions, users } = useGraphContext('public', graphUuid, route === 'graph')
  const login = () => { window.location.hash = 'login' }
  const openGraph = (graphUuid: string) => { window.location.hash = 'graph?graphUuid=' + encodeURIComponent(graphUuid) }
  const openNode = (node: ActionNode, mode: ActionDocumentMode) => {
    window.location.hash = 'graph?' + new URLSearchParams({ graphUuid: node.graphUuid, nodeUuid: node.uuid, document: mode }).toString()
  }
  const openReference = (reference: ActionReference) => {
    window.location.hash = 'graph?' + new URLSearchParams({ graphUuid: reference.target.graphUuid, referenceUuid: reference.uuid }).toString()
  }
  const nodeUuid = query.get('nodeUuid')
  const referenceUuid = query.get('referenceUuid')
  const document = query.get('document')
  const externalFocus = nodeUuid
    ? { requestId: `guest:${nodeUuid}:${document ?? 'objective'}`, nodeUuid, mode: (document === 'expression' || document === 'agreement' ? document : 'objective') as ActionDocumentMode }
    : referenceUuid ? { requestId: `guest:${referenceUuid}`, referenceUuid } : undefined

  return (
    <div className="relative isolate mx-auto min-h-screen w-[min(1200px,calc(100%-72px))] pt-[30px] max-[1000px]:w-[min(920px,calc(100%-48px))]">
      <AppBackdrop />
      <header className="flex min-h-[66px] items-center justify-between gap-4">
        <a className="inline-flex w-max rounded-sm" href="#home" title="引序 公开内容"><Brand /></a>
        <div className="flex items-center gap-2">
          {selectedGraph && <button className="quiet-button" type="button" onClick={() => navigate('home')}><ArrowLeft size={15} />返回</button>}
          <button className="quiet-button" type="button" onClick={login} title="登录引序"><LogIn size={15} />登录</button>
        </div>
      </header>
      {selectedGraph ? (
        <main className="pb-20">
          <div className="mx-auto w-full max-w-[1000px]">
          <GraphPage
            graph={selectedGraph}
            active
            externalFocus={externalFocus}
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
          </div>
        </main>
      ) : (
        <main className="pb-20">
          <Discovery
            actions={[]}
            graphs={[]}
            users={users}
            active
            showRecentGraphs={false}
            remoteFeed={remoteFeed}
            onOpenNode={openNode}
            onOpenReference={openReference}
            onOpenGraph={openGraph}
            onSearchGraphs={() => undefined}
          />
        </main>
      )}
    </div>
  )
}
