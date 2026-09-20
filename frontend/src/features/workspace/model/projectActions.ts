import { archiveProject, createProject, deleteProject, restoreArchivedProject, setProjectSmartContract, updateProjectProfile } from '@/entities/project/api/client'
import { currentRevision, mergeProjectState } from './projectState'
import type { WorkspaceState } from './dto'
import type { WorkspaceGet, WorkspaceSet } from './actionContext'

type ProjectActions = Pick<WorkspaceState, 'createProject' | 'updateProjectProfile' | 'setProjectSmartContract' | 'archiveProject' | 'restoreArchivedProject' | 'deleteProject'>

/** 项目生命周期 action。远端写入成功后，统一以最新项目快照更新缓存。 */
export function createProjectActions(set: WorkspaceSet, get: WorkspaceGet): ProjectActions {
  return {
    createProject: async (input) => {
      const accessToken = get().accessToken
      if (!accessToken) throw new Error('请先登录后再创建项目。')
      const project = await createProject(accessToken, input)
      if (!project.uuid) throw new Error('项目创建失败。')
      set((state) => ({ projects: [...state.projects.filter((item) => item.uuid !== project.uuid), project] }))
      return project.uuid
    },
    updateProjectProfile: async (projectUuid, input) => {
      const title = input.title.trim()
      const description = input.description.trim()
      if (!title) return { success: false, message: '项目名称不能为空。' }
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再修改项目。' }
      try {
        const snapshot = await updateProjectProfile(accessToken, projectUuid, { title, description, visibility: input.visibility })
        set((state) => mergeProjectState(state, snapshot))
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : '保存项目资料失败。' }
      }
    },
    setProjectSmartContract: async (projectUuid, smartContractUuid) => {
      const smartContract = get().smartContracts.find((item) => item.uuid === smartContractUuid)
      const project = get().projects.find((item) => item.uuid === projectUuid)
      if (!project || project.archivedAt || project.projectType !== 'autonomous' || !smartContract) {
        return { success: false, message: '只有未归档的自主推进型项目可以修改智能合约。' }
      }
      const active = currentRevision(project)
      if (active.smartContractUuid === smartContract.uuid && active.smartContractVersion === smartContract.version) {
        return { success: false, message: '该合约已经是项目当前配置。' }
      }
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再修改项目规则。' }
      try {
        const snapshot = await setProjectSmartContract(accessToken, projectUuid, smartContractUuid)
        set((state) => mergeProjectState(state, snapshot))
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : '更新项目智能合约失败。' }
      }
    },
    archiveProject: async (projectUuid) => {
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再归档项目。' }
      try {
        await archiveProject(accessToken, projectUuid)
        await get().refreshWorkspace()
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : '归档项目失败。' }
      }
    },
    restoreArchivedProject: async (projectUuid) => {
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再恢复项目。' }
      try {
        await restoreArchivedProject(accessToken, projectUuid)
        await get().refreshWorkspace()
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : '恢复项目失败。' }
      }
    },
    deleteProject: async (projectUuid) => {
      const project = get().projects.find((item) => item.uuid === projectUuid)
      if (!project) return { success: false, message: '项目不存在。' }
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再删除项目。' }
      try {
        await deleteProject(accessToken, projectUuid)
        const contractUuids = new Set(get().contracts.filter((contract) => contract.projectUuid === projectUuid).map((contract) => contract.uuid))
        set((state) => ({
          projects: state.projects.filter((item) => item.uuid !== projectUuid),
          contracts: state.contracts.filter((contract) => contract.projectUuid !== projectUuid),
          branches: state.branches.filter((branch) => branch.projectUuid !== projectUuid),
          completionRecords: state.completionRecords.filter((record) => record.projectUuid !== projectUuid),
          edges: state.edges.filter((edge) => !contractUuids.has(edge.sourceContractUuid) && !contractUuids.has(edge.targetContractUuid)),
        }))
        return { success: true }
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : '删除项目失败。' }
      }
    },
  }
}
