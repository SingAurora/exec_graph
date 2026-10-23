import type { ActionNode } from '../entities/action/model/types'
import type { Project } from '../entities/project/model/types'
import type { UserProfile } from '../entities/profile/model/types'
import { ActionArchive } from '../widgets/action-archive/ui/ActionArchive'

/** 形成过程页面；key 按节点区分，切换记录时重新初始化对应资料页。 */
export function ActionArchivePage(props: { project: Project; node: ActionNode; actions: ActionNode[]; users: UserProfile[]; onBack: () => void; onSelectSource: (id: string) => void }) {
  return <ActionArchive key={props.node.id} {...props} />
}
