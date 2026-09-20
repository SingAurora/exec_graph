import type { WorkspaceState } from './dto'

/** Zustand action 工厂使用的最小上下文，防止领域 action 依赖 store 实现细节。 */
export type WorkspaceSet = (
  partial: Partial<WorkspaceState> | ((state: WorkspaceState) => Partial<WorkspaceState>),
) => void

export type WorkspaceGet = () => WorkspaceState
