import { getJSON, postJSON, requestFormData, withQuery } from '@/shared/api/client'
import type { Gender, PublicProfile } from '../model/types'

export type CurrentUserProfile = {
  username: string
  userId: string
  bio?: string
  gender?: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

export type UpdateCurrentUserProfileInput = {
  username: string
  userId: string
  bio: string
  gender: Gender
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

export const getCurrentUserProfile = (accessToken: string) =>
  getJSON<{ user?: CurrentUserProfile }>('/api/commands/users/get-current-user-profile', accessToken)

export const updateCurrentUserProfile = (accessToken: string, input: UpdateCurrentUserProfileInput) =>
  postJSON<{ user?: CurrentUserProfile }>('/api/commands/users/update-current-user-profile', input, accessToken)

/** 按稳定用户 ID 读取无需登录即可访问的公开个人页。 */
export const getPublicUserProfile = (userId: string) =>
  getJSON<PublicProfile>(withQuery('/api/commands/explore/get-public-user-profile', { userId }))

export async function uploadCurrentUserAvatar(accessToken: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('avatar', file)
  const data = await requestFormData<{ avatarUrl?: string }>('/api/commands/users/upload-current-user-avatar', formData, accessToken)
  if (!data.avatarUrl) throw new Error('头像上传失败，请稍后重试。')
  return data.avatarUrl
}

export async function uploadCurrentUserProfileBackground(accessToken: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('background', file)
  const data = await requestFormData<{ profileBackgroundUrl?: string }>('/api/commands/users/upload-current-user-profile-background', formData, accessToken)
  if (!data.profileBackgroundUrl) throw new Error('背景图片上传失败，请稍后重试。')
  return data.profileBackgroundUrl
}
