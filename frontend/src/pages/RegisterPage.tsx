import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, MailCheck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '@/widgets/auth-layout/ui/AuthLayout'
import { postJSON } from '@/shared/api/client'
import { useWorkspaceStore } from '@/features/workspace/model/useWorkspaceStore'

const registerSchema = z.object({
  username: z.string().min(2, '请输入至少两个字符的用户名。').max(64, '用户名不能超过 64 个字符。'),
  email: z.string().email('请输入有效邮箱。'),
  password: z.string().min(6, '密码至少需要 6 个字符。'),
  code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码。'),
})

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const setAccessToken = useWorkspaceStore((state) => state.setAccessToken)
  const refreshWorkspace = useWorkspaceStore((state) => state.refreshWorkspace)
  const [authError, setAuthError] = useState('')
  const [notice, setNotice] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  useEffect(() => {
    if (countdown === 0) return
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  const sendCode = async () => {
    setAuthError('')
    setNotice('')
    if (!(await trigger('email'))) return

    setIsSendingCode(true)
    try {
      const data = await postJSON<{ message?: string }>('/api/commands/auth/send-code', { email: getValues('email') })
      setCountdown(60)
      setNotice(data.message ?? '验证码已发送，请查收邮件。')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '验证码发送失败，请稍后重试。')
    } finally {
      setIsSendingCode(false)
    }
  }

  const onSubmit = async (values: RegisterForm) => {
    setAuthError('')
    setNotice('')
    try {
      const data = await postJSON<{ accessToken?: string; user?: { userId?: string } }>('/api/commands/auth/register', values)
      if (!data.accessToken) {
        setAuthError('账号已创建，但登录会话创建失败，请稍后重试。')
        return
      }

      if (!data.user?.userId) {
        setAuthError('账号已创建，但用户 ID 生成失败，请稍后重新登录。')
        return
      }
      setAccessToken(data.accessToken)
      const workspace = await refreshWorkspace()
      if (!workspace.success) {
        setAuthError(workspace.message ?? '账号已创建，但无法读取你的工作区。')
        return
      }
      navigate('/')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    }
  }

  return (
    <AuthLayout
      eyebrow="Create identity"
      title="注册"
      description="创建一个用于签名和公开记录的演示身份。"
      footer={
        <span>
          已有身份？{' '}
          <Link className="font-semibold text-signal hover:text-ink" to="/login">
            返回登录
            <ArrowRight className="ml-1 inline-block" size={14} aria-hidden="true" />
          </Link>
        </span>
      }
    >
      <form className="rounded-md border border-rail bg-surface/72 p-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">用户名</span>
            <input
              autoComplete="username"
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
              {...register('username')}
            />
            {errors.username?.message ? <span className="text-sm font-medium text-clay">{errors.username.message}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">邮箱</span>
            <div className="flex gap-2">
              <input
                type="email"
                autoComplete="email"
                className="h-11 min-w-0 flex-1 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
                {...register('email')}
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={isSendingCode || countdown > 0}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-rail bg-surface px-3 text-sm font-semibold text-ink transition hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:shadow-focusline"
              >
                <MailCheck size={16} aria-hidden="true" />
                {isSendingCode ? '发送中' : countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
              </button>
            </div>
            {errors.email?.message ? <span className="text-sm font-medium text-clay">{errors.email.message}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">邮箱验证码</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="输入 6 位验证码"
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm tracking-[0.2em] outline-none focus:border-signal focus:shadow-focusline"
              {...register('code')}
            />
            {errors.code?.message ? <span className="text-sm font-medium text-clay">{errors.code.message}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">密码</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="h-11 w-full rounded-md border border-rail bg-paper px-3 pr-11 text-sm outline-none focus:border-signal focus:shadow-focusline"
                {...register('password')}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline" aria-label={showPassword ? '隐藏密码' : '显示密码'} title={showPassword ? '隐藏密码' : '显示密码'}>
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {errors.password?.message ? <span className="text-sm font-medium text-clay">{errors.password.message}</span> : null}
          </label>
          {notice ? <p className="text-sm font-medium text-signal" role="status">{notice}</p> : null}
          {authError ? <p className="text-sm font-medium text-clay" role="alert">{authError}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
          >
            <UserPlus size={17} aria-hidden="true" />
            创建并进入
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
