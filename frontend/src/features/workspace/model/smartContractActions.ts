import { createSmartContract, deleteSmartContract } from '@/entities/smart-contract/api/client'
import type { WorkspaceState } from './dto'
import type { WorkspaceGet, WorkspaceSet } from './actionContext'

type SmartContractActions = Pick<WorkspaceState, 'createSmartContract' | 'deleteSmartContract'>

/** 智能合约库的创建和删除，以及对应的工作区缓存同步。 */
export function createSmartContractActions(set: WorkspaceSet, get: WorkspaceGet): SmartContractActions {
  return {
    createSmartContract: async (input) => {
      const accessToken = get().accessToken
      if (!accessToken) return null
      try {
        const contract = await createSmartContract(accessToken, input)
        if (!contract.uuid) return null
        set((state) => ({
          smartContracts: [...state.smartContracts.filter((item) => item.uuid !== contract.uuid), contract],
        }))
        return contract.uuid
      } catch {
        return null
      }
    },
    deleteSmartContract: async (contractUuid) => {
      const accessToken = get().accessToken
      if (!accessToken) return { success: false, message: '请先登录后再删除智能合约。' }
      try {
        await deleteSmartContract(accessToken, contractUuid)
        set((state) => ({ smartContracts: state.smartContracts.filter((contract) => contract.uuid !== contractUuid) }))
        return { success: true }
      } catch {
        return { success: false, message: '无法连接服务，请确认后端已启动。' }
      }
    },
  }
}
