import { postJSON } from '@/shared/api/client'

export type LoginInput = { email: string; password: string }
export type RegisterAccountInput = LoginInput & { username: string; code: string }
export type ResetPasswordInput = { email: string; code: string; nextPassword: string }
export type ChangeEmailInput = { email: string; currentPassword: string; code: string }
export type ChangePasswordInput = { currentPassword: string; nextPassword: string; code: string }

export const sendVerificationCode = (input: { email?: string; purpose?: 'reset_password' | 'change_email' | 'change_password' }, accessToken?: string) =>
  postJSON<{ message?: string }>('/api/commands/auth/send-verification-code', input, accessToken)

export const loginWithPassword = (input: LoginInput) =>
  postJSON<{ accessToken?: string }>('/api/commands/auth/login-with-password', input)

export const registerAccount = (input: RegisterAccountInput) =>
  postJSON<{ accessToken?: string; user?: { userId?: string } }>('/api/commands/auth/register-account', input)

export const resetLoginPassword = (input: ResetPasswordInput) =>
  postJSON<{ message?: string }>('/api/commands/auth/reset-login-password', input)

export const changeLoginEmail = (accessToken: string, input: ChangeEmailInput) =>
  postJSON<void>('/api/commands/auth/change-login-email', input, accessToken)

export const changeLoginPassword = (accessToken: string, input: ChangePasswordInput) =>
  postJSON<void>('/api/commands/auth/change-login-password', input, accessToken)
