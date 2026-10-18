import { useEffect, useState } from 'react'
import type { ActionNode } from '../entities/action/model/types'
import type { Project, UserProfile } from '../shared/model'
import { PublicProfile } from '../widgets/profile/PublicProfile'

function readProfileId() {
  return new URLSearchParams(window.location.hash.split('?')[1]).get('userId')
}

/** Resolves the public profile route and composes its author overview. */
export function ProfilePage({ users, projects, actions, onOpenProject }: { users: UserProfile[]; projects: Project[]; actions: ActionNode[]; onOpenProject: (id: string) => void }) {
  const [userId, setUserId] = useState(readProfileId)
  useEffect(() => {
    const syncProfile = () => setUserId(readProfileId())
    window.addEventListener('hashchange', syncProfile)
    return () => window.removeEventListener('hashchange', syncProfile)
  }, [])
  const profile = users.find((user) => user.id === userId)
  return profile ? <PublicProfile profile={profile} projects={projects} actions={actions} onOpenProject={onOpenProject} /> : <p className="py-8 text-sm text-muted">用户不存在</p>
}
