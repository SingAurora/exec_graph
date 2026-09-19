import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '../components/AuthLayout'
import { parseJSONResponse } from '../lib/api'
import { useExecStore } from '../store/useExecStore'

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱。'),
  password: z.string().min(1, '请输入密码。'),
})

type LoginForm = z.infer<typeof loginSchema>

const testAccount = {
  email: import.meta.env.VITE_TEST_ACCOUNT_EMAIL ?? 'test@execgraph.local',
  password: import.meta.env.VITE_TEST_ACCOUNT_PASSWORD ?? '',
}

export function LoginPage() {
  const navigate = useNavigate()
  const registerAccount = useExecStore((state) => state.registerAccount)
  const setAccessToken = useExecStore((state) => state.setAccessToken)
  const refreshWorkspace = useExecStore((state) => state.refreshWorkspace)
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: testAccount,
  })

  const onSubmit = async (values: LoginForm) => {
    setAuthError('')
    try {
      const response = await fetch('/api/commands/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const data = await parseJSONResponse<{ accessToken?: string; user?: { username?: string; userId?: string } }>(response)
      if (!data.accessToken) {
        setAuthError('邮箱或密码不正确。')
        return
      }
      const result = registerAccount(data.user?.username ?? values.email.split('@')[0], data.user?.userId ?? values.email.split('@')[0], values.email, values.password)
      if (!result.success) {
        setAuthError(result.message ?? '登录失败，请稍后重试。')
        return
      }
      setAccessToken(data.accessToken)
      const workspace = await refreshWorkspace()
      if (!workspace.success) {
        setAuthError(workspace.message ?? '登录成功，但无法读取你的工作区。')
        return
      }
      navigate('/')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '无法连接服务，请确认后端已启动。')
    }
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="登录"
      description="使用邮箱登录你的项目。"
      footer={
        <span>
          还没有身份？{' '}
          <Link className="font-semibold text-signal hover:text-ink" to="/register">
            注册账号
            <ArrowRight className="ml-1 inline-block" size={14} aria-hidden="true" />
          </Link>
        </span>
      }
    >
      <form className="rounded-md border border-rail bg-surface/72 p-5" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">邮箱</span>
            <input
              type="email"
              autoComplete="email"
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
              {...register('email')}
            />
            {errors.email?.message ? <span className="text-sm font-medium text-clay">{errors.email.message}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">密码</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-11 w-full rounded-md border border-rail bg-paper px-3 pr-11 text-sm outline-none focus:border-signal focus:shadow-focusline"
                {...register('password')}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-graphite transition hover:text-ink focus:outline-none focus-visible:shadow-focusline" aria-label={showPassword ? '隐藏密码' : '显示密码'} title={showPassword ? '隐藏密码' : '显示密码'}>
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {errors.password?.message ? <span className="text-sm font-medium text-clay">{errors.password.message}</span> : null}
          </label>
          {authError ? <p className="text-sm font-medium text-clay" role="alert">{authError}</p> : null}
          <Link to="/forgot-password" className="justify-self-start text-sm font-semibold text-signal transition hover:text-ink focus:outline-none focus-visible:shadow-focusline">忘记密码？</Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-signal px-4 text-sm font-semibold text-white transition hover:bg-signalStrong disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
          >
            <LogIn size={17} aria-hidden="true" />
            登录
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
