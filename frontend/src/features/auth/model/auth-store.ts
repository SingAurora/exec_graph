import { create } from 'zustand'
import { login as loginAccount, logout as logoutAccount, register as registerAccount, type RegisterInput } from '../api/account'
import { readSession, type AccountProfile } from '../../../entities/profile/api/profiles'
import { clearAuthToken, readAuthToken, writeAuthToken } from '../../../shared/api/auth-token'

/** 认证状态：启动检查、已登录、未登录、会话读取失败。 */
export type AuthStatus = 'booting' | 'signed-in' | 'signed-out' | 'error'

type AuthState = {
  /** 当前认证阶段；UI 只依赖这个字段决定展示登录页、应用还是加载页。 */
  status: AuthStatus
  /** 当前登录用户；未登录和启动检查期间为 null。 */
  user: AccountProfile | null
  /** 启动时无法读取会话的原因；登录/注册表单错误不写入这里。 */
  error: string | null
  /** 页面启动时调用：有 token 就向服务端确认会话，否则直接进入未登录。 */
  bootstrap: () => Promise<void>
  /** 启动失败后重试读取会话。 */
  retry: () => Promise<void>
  /** 登录并保存 token；失败时异常交给 AuthScreen 展示。 */
  login: (email: string, password: string) => Promise<void>
  /** 注册并直接建立登录会话；失败时异常交给 AuthScreen 展示。 */
  register: (input: RegisterInput) => Promise<void>
  /** 资料修改成功后同步当前用户，不重新请求会话。 */
  setUser: (user: AccountProfile) => void
  /** 撤销服务端会话并清空本地登录态；服务端失败也保证本地退出。 */
  logout: () => Promise<void>
  /** 服务端已判定会话失效时的本地清理，不再次请求退出接口。 */
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
    // 只在启动阶段执行；retry 会先恢复 booting 再重新进入。
    if (get().status !== 'booting') return
    if (bootstrapPromise) return bootstrapPromise
    bootstrapPromise = (async () => {
      // 没有 token 时不需要请求服务端，直接作为未登录处理。
      if (!readAuthToken()) {
        set({ status: 'signed-out', user: null, error: null })
        return
      }
      try {
        // readSession 在 10002 时会自行清除失效 token，并返回 null。
        const session = await readSession()
        if (!session) {
          set({ status: 'signed-out', user: null, error: null })
          return
        }
        set({ status: 'signed-in', user: session.user, error: null })
      } catch (error) {
        // 网络或服务错误不能当成未登录，保留错误让用户重试。
        set({ status: 'error', user: null, error: errorMessage(error) })
      }
    })()
    try {
      await bootstrapPromise
    } finally {
      // 无论成功失败都释放共享请求，后续 retry 可以重新读取。
      bootstrapPromise = null
    }
  },

  retry: async () => {
    // bootstrap 只接受 booting，因此重试前先恢复启动状态。
    set({ status: 'booting', user: null, error: null })
    await get().bootstrap()
  },

  login: async (email, password) => {
    const session = await loginAccount(email, password)
    // token 只放 localStorage；store 中保存用户和认证状态。
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
      // 只有存在 token 时才需要请求服务端撤销会话。
      if (readAuthToken()) await logoutAccount()
    } catch {
      // 本地退出优先；服务端会话会在过期后失效。
    } finally {
      clearAuthToken()
      set({ status: 'signed-out', user: null, error: null })
    }
  },

  expire: () => {
    // 服务端已经认为会话失效，只需要清理本地 token 和用户。
    clearAuthToken()
    set({ status: 'signed-out', user: null, error: null })
  },
}))
