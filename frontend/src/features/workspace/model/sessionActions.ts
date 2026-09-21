import type { Actor } from '@/entities/account/model/types'
import { getCurrentUserProfile } from '@/entities/account/api/client'
import { listAvailableSmartContracts } from '@/entities/smart-contract/api/client'
import { getProjectExecutionGraph, listOwnedProjects } from '@/entities/project/api/client'
import { normalizeExecutionContract, normalizeProject } from './projectState'
import type { WorkspaceGet, WorkspaceSet } from './actionContext'
import type { WorkspaceState } from './dto'

export function createSessionActions(set: WorkspaceSet, get: WorkspaceGet): Pick<WorkspaceState, 'setAccessToken' | 'refreshWorkspace' | 'signOut' | 'updateProfile' | 'updateAccountEmail' | 'updateAccountPassword'> {
  return {
      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: Boolean(token) }),
      refreshWorkspace: async () => {
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '当前没有登录会话。' }
        try {
          const [profileData, projectData, smartContractData] = await Promise.all([
            getCurrentUserProfile(accessToken),
            listOwnedProjects(accessToken),
            listAvailableSmartContracts(accessToken),
          ])
          if (!profileData.user?.userId || !projectData.projects || !smartContractData.smartContracts) {
            throw new Error('读取账户工作区失败。')
          }
          const snapshots = await Promise.all(projectData.projects.map((project) => getProjectExecutionGraph(accessToken, project.uuid)))
          const profileUser = profileData.user
          const actorId = profileUser.userId ?? ''
          const actor: Actor = {
            id: actorId,
            name: profileUser.username ?? profileUser.userId ?? '未命名用户',
            handle: `@${profileUser.userId ?? actorId}`,
            role: '成员',
            bio: profileUser.bio ?? '',
            gender: profileUser.gender ?? 'undisclosed',
            avatarUrl: profileUser.avatarUrl,
            profileBackgroundUrl: profileUser.profileBackgroundUrl,
            customProfileEnabled: profileUser.customProfileEnabled,
            customProfileMarkdown: profileUser.customProfileMarkdown,
          }
          set({
            currentActorId: actorId,
            actors: [actor],
            projects: projectData.projects.map(normalizeProject),
            smartContracts: smartContractData.smartContracts,
            contracts: snapshots.flatMap((snapshot) => snapshot.nodes.map(normalizeExecutionContract)),
            branches: snapshots.flatMap((snapshot) => snapshot.branches),
            completionRecords: snapshots.flatMap((snapshot) => snapshot.completionRecords),
            edges: snapshots.flatMap((snapshot) => snapshot.edges),
          })
          return { success: true }
        } catch (error) {
          set({
            actors: [],
            currentActorId: '',
            projects: [],
            smartContracts: [],
            branches: [],
            contracts: [],
            completionRecords: [],
            edges: [],
          })
          return {
            success: false,
            message: error instanceof Error ? error.message : '读取账户工作区失败。',
          }
        }
      },
      signOut: () =>
        set({
          isAuthenticated: false,
          accessToken: '',
          accountEmail: '',
          actors: [],
          currentActorId: '',
          projects: [],
          smartContracts: [],
          branches: [],
          contracts: [],
          completionRecords: [],
          edges: [],
        }),
      updateProfile: (input) => {
        const normalizedUserID = input.userId.trim().replace(/^@+/, '')
        set((state) => ({
          actors: state.actors.map((actor) =>
            actor.id === state.currentActorId
              ? {
                  ...actor,
                  name: input.username.trim(),
                  handle: `@${normalizedUserID}`,
                  bio: input.bio.trim(),
                  gender: input.gender,
                  avatarUrl: input.avatarUrl ?? actor.avatarUrl,
                  profileBackgroundUrl: input.profileBackgroundUrl ?? actor.profileBackgroundUrl,
                  customProfileEnabled: input.customProfileEnabled,
                  customProfileMarkdown: input.customProfileMarkdown,
                }
              : actor,
          ),
        }))
      },
      updateAccountEmail: (email) => {
        set({ accountEmail: email.trim().toLowerCase() })
        return { success: true }
      },
      updateAccountPassword: () => ({ success: true }),

  }
}
