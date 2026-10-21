import type { ActionReference } from '../../entities/action/lib/references'
import { GraphContextLink } from '../../entities/project/ui/GraphContextLink'
import type { Project } from '../../entities/project/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { AgreementResponseList } from '../agreement-responses/ui/AgreementResponseList'

/** Reuses the public feed item for a recent personal agreement exchange. */
export function DashboardAgreementCard({ reference, users, project, onOpenReference, onOpenProject }: {
  reference: ActionReference; users: UserProfile[]; project?: Project
  onOpenReference: (reference: ActionReference) => void; onOpenProject: (id: string) => void
}) {
  return <AgreementResponseList references={[reference]} users={users} active infinite={false} presentation="feed" onExplore={onOpenReference}
    renderContext={() => <GraphContextLink id={reference.target.projectId} title={project?.title} onOpen={onOpenProject} />} />
}
