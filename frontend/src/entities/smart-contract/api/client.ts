import { getJSON, postJSON } from '@/shared/api/client'
import type { SmartContractDefinition } from '../model/types'

export type CreateSmartContractInput = Pick<SmartContractDefinition, 'name' | 'description' | 'body'>
export type SmartContractEvent = {
  uuid: string
  contractUuid: string
  eventType: 'created' | 'deleted'
  smartContract: SmartContractDefinition
  createdAt: string
}

export const listAvailableSmartContracts = (accessToken: string) =>
  getJSON<{ smartContracts?: SmartContractDefinition[] }>('/api/commands/contracts/list-available-smart-contracts', accessToken)

export const listSmartContractHistory = (accessToken: string) =>
  getJSON<{ events?: SmartContractEvent[] }>('/api/commands/contracts/list-smart-contract-history', accessToken)

export const createSmartContract = (accessToken: string, input: CreateSmartContractInput) =>
  postJSON<SmartContractDefinition>('/api/commands/contracts/create-smart-contract', input, accessToken)

export const deleteSmartContract = (accessToken: string, contractUuid: string) =>
  postJSON<void>('/api/commands/contracts/delete-smart-contract', { contractUuid }, accessToken)
