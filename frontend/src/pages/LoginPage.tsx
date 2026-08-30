import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '../components/AuthLayout'
import { useExecStore } from '../store/useExecStore'

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱。'),
  password: z.string().min(1, '请输入密码。'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const signIn = useExecStore((state) => state.signIn)
  const [authError, setAuthError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'demo@execgraph.local', password: 'execgraph' },
  })

  const onSubmit = (values: LoginForm) => {
    const result = signIn(values.email, values.password)
    if (!result.success) {
      setAuthError(result.message ?? '登录失败，请稍后重试。')
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="登录"
      description="使用演示身份进入你的项目。"
      footer={
        <span>
          还没有身份？{' '}
          <Link className="font-semibold text-signal hover:text-ink" to="/register">
            创建演示账号
            <ArrowRight className="ml-1 inline-block" size={14} aria-hidden="true" />
          </Link>
        </span>
      }
    >
      <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleSubmit(onSubmit)}>
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
            <input
              type="password"
              autoComplete="current-password"
              className="h-11 rounded-md border border-rail bg-paper px-3 text-sm outline-none focus:border-signal focus:shadow-focusline"
              {...register('password')}
            />
            {errors.password?.message ? <span className="text-sm font-medium text-clay">{errors.password.message}</span> : null}
          </label>
          {authError ? <p className="text-sm font-medium text-clay" role="alert">{authError}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:shadow-focusline"
          >
            <LogIn size={17} aria-hidden="true" />
            登录
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
