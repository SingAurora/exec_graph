import { Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ActionDocumentMode, ActionNode } from '../../entities/action/model/types'
import { getProfileHighlightCandidates } from '../../entities/action/lib/profile-highlights'
import type { UserProfile } from '../../entities/profile/model/types'
import { profileHighlightLimit } from '../../entities/profile/model/highlights'
import type { Project } from '../../entities/project/model/types'
import { ChooseProfileHighlights } from '../../features/profile-highlights/ui/ChooseProfileHighlights'
import { ProfileHighlightItem } from './ProfileHighlightItem'

/** 主页最多展示五个自主排序的表达；约定来自各自选中分支，不单独精选。 */
export function ProfileHighlights({ profile, self, actions, projects, users, onOpenNode }: {
  profile: UserProfile; self: boolean; actions: ActionNode[]; projects: Project[]; users: UserProfile[]
  onOpenNode: (node: ActionNode, mode: ActionDocumentMode) => void
}) {
  const [editing, setEditing] = useState(false)
  const editRef = useRef<HTMLButtonElement>(null)
  const candidates = getProfileHighlightCandidates(actions, profile.id)
  const entries = [...new Set(profile.highlights?.expressionNodeIds ?? [])].slice(0, profileHighlightLimit)
    .flatMap((id) => candidates.filter(({ node }) => node.id === id))
  if (!self && !entries.length) return null

  return (
    <section className="border-b border-line py-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">主页精选</h3>
        {self && <button ref={editRef} type="button" className="text-button text-xs" onClick={() => setEditing(true)}><Pencil size={13} />编辑精选</button>}
      </div>
      {!entries.length && <p className="py-3 text-sm text-muted">尚未精选表达</p>}
      <ol className="divide-y divide-line">{entries.map((entry) => <li key={entry.node.id} className="min-w-0">
        <ProfileHighlightItem entry={entry} actions={actions} projects={projects} users={users} onOpenNode={onOpenNode} />
      </li>)}</ol>
      {editing && <ChooseProfileHighlights userId={profile.id} highlights={profile.highlights} candidates={candidates} projects={projects} returnFocusRef={editRef} onClose={() => setEditing(false)} />}
    </section>
  )
}
