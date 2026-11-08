import type { ActionReference } from '../../entities/action/lib/references'
import { GraphContextLink } from '../../entities/graph/ui/GraphContextLink'
import type { Graph } from '../../entities/graph/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { AgreementResponseList } from '../agreement-responses/ui/AgreementResponseList'

/** Reuses the public feed item for a recent personal agreement exchange. */
export function DashboardAgreementCard({ reference, users, graph, onOpenReference, onOpenGraph }: {
  reference: ActionReference; users: UserProfile[]; graph?: Graph
  onOpenReference: (reference: ActionReference) => void; onOpenGraph: (id: string) => void
}) {
  return (
    <AgreementResponseList references={[reference]} users={users} active infinite={false} presentation="feed" onExplore={onOpenReference}
      renderContext={() => <GraphContextLink id={reference.target.graphId} title={graph?.title} onOpen={onOpenGraph} />} />
  )
}
