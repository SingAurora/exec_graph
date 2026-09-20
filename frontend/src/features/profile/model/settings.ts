import { z } from 'zod'
import { Settings2, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import type { Gender } from '@/entities/account/model/types'
import type { AIKey, AIProvider } from '@/entities/ai-key/model/types'

export const profileSchema = z.object({
  username: z.string().trim().min(2, '请输入至少两个字符的用户名。').max(64, '用户名最多 64 个字符。'),
  userId: z.string().trim().regex(/^@?[a-zA-Z0-9_]{2,24}$/, '用户 ID 需要是 2 到 24 位字母、数字或下划线。'),
  gender: z.enum(['female', 'male', 'undisclosed']),
  bio: z.string().max(120, '个人说明最多 120 个字符。'),
  customProfileEnabled: z.boolean(),
  customProfileMarkdown: z.string().max(20000, '自定义主页最多 20000 个字符。'),
})

export const emailSchema = z.object({
  email: z.string().email('请输入有效邮箱。'),
  currentPassword: z.string().min(1, '请输入当前密码。'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码。'),
})

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码。'),
  nextPassword: z.string().min(6, '新密码至少需要 6 个字符。'),
  confirmation: z.string().min(1, '请再次输入新密码。'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码。'),
}).refine((values) => values.nextPassword === values.confirmation, {
  message: '两次输入的新密码不一致。',
  path: ['confirmation'],
})

export type ProfileForm = z.infer<typeof profileSchema>
export type EmailForm = z.infer<typeof emailSchema>
export type PasswordForm = z.infer<typeof passwordSchema>
export type SettingsSection = 'profile' | 'account' | 'execution'
export type ProfileSection = 'basic' | 'custom'
export type AccountSection = 'email' | 'password'
export type ExecutionSection = 'keys' | 'contracts'
export type { AIKey, AIProvider }

export const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'undisclosed', label: '不透露' },
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
]

export const settingsSections: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [
  { id: 'profile', label: '个人资料', icon: UserRound },
  { id: 'account', label: '账户安全', icon: ShieldCheck },
  { id: 'execution', label: '执行配置', icon: Settings2 },
]

export const aiProviderOptions: Array<{ id: AIProvider; label: string; baseUrl: string; modelPlaceholder: string; labelPlaceholder: string }> = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', labelPlaceholder: '例如：个人 DeepSeek', modelPlaceholder: '例如：deepseek-chat' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', labelPlaceholder: '例如：个人 OpenAI', modelPlaceholder: '例如：gpt-4o-mini' },
  { id: 'doubao', label: '豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', labelPlaceholder: '例如：个人豆包', modelPlaceholder: '例如：doubao-seed-1-6-250615' },
  { id: 'claude', label: 'Claude', baseUrl: 'https://api.anthropic.com/v1', labelPlaceholder: '例如：个人 Claude', modelPlaceholder: '例如：claude-sonnet-4-5-20250929' },
]

export const controlClass = 'h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline'
