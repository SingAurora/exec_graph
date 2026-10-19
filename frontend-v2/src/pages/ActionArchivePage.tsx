import type { ActionNode } from '../entities/action/model/types'
import type { Project, UserProfile } from '../shared/model'
import { ActionArchive } from '../widgets/action-archive/ui/ActionArchive'

/** Composes the selected action's formation archive. */
export function ActionArchivePage(props: { project: Project; node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onBack: () => void; onSelectSource: (id: string) => void }) {
  return <ActionArchive key={props.node.id} {...props} />
}
