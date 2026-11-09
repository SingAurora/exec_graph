import { create } from 'zustand'
import { login as loginAccount, logout as logoutAccount, register as registerAccount, type RegisterInput } from '../api/account'
import { readSession, type AccountProfile } from '../../../entities/profile/api/profiles'
import { clearAuthToken, readAuthToken, writeAuthToken } from '../../../shared/api/auth-token'

export type AuthStatus = 'booting' | 'signed-in' | 'signed-out' | 'error'

type AuthState = {
  status: AuthStatus
  user: AccountProfile | null
  error: string | null
  bootstrap: () => Promise<void>
  retry: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  setUser: (user: AccountProfile) => void
  logout: () => Promise<void>
  expire: () => void
}

// StrictMode 会在开发环境执行两次 effect；共享同一个启动请求，避免重复读取会话。
let bootstrapPromise: Promise<void> | null = null

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '无法读取登录状态，请重试'
}

/** 全应用唯一的登录状态；token 仍在 localStorage，只在这里保存当前用户。 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'booting',
  user: null,
  error: null,

  bootstrap: async () => {
    if (get().status !== 'booting') return
    if (bootstrapPromise) return bootstrapPromise
    bootstrapPromise = (async () => {
      if (!readAuthToken()) {
        set({ status: 'signed-out', user: null, error: null })
        return
      }
      try {
        const session = await readSession()
        if (!session) {
          set({ status: 'signed-out', user: null, error: null })
          return
        }
        set({ status: 'signed-in', user: session.user, error: null })
      } catch (error) {
        set({ status: 'error', user: null, error: errorMessage(error) })
      }
    })()
    try {
      await bootstrapPromise
    } finally {
      bootstrapPromise = null
    }
  },

  retry: async () => {
    set({ status: 'booting', user: null, error: null })
    await get().bootstrap()
  },

  login: async (email, password) => {
    const session = await loginAccount(email, password)
    if (session.token) writeAuthToken(session.token)
    set({ status: 'signed-in', user: session.user, error: null })
  },

  register: async (input) => {
    const session = await registerAccount(input)
    if (session.token) writeAuthToken(session.token)
    set({ status: 'signed-in', user: session.user, error: null })
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    try {
      if (readAuthToken()) await logoutAccount()
    } catch {
      // 本地退出优先；服务端会话会在过期后失效。
    } finally {
      clearAuthToken()
      set({ status: 'signed-out', user: null, error: null })
    }
  },

  expire: () => {
    clearAuthToken()
    set({ status: 'signed-out', user: null, error: null })
  },
}))
