import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthLayout } from '../components/AuthLayout'
import { useExecStore } from '../store/useExecStore'

const registerSchema = z.object({
  username: z.string().min(2, '请输入至少两个字符的用户名。'),
  email: z.string().email('请输入有效邮箱。'),
  password: z.string().min(6, '密码至少需要 6 个字符。'),
})

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const registerAccount = useExecStore((state) => state.registerAccount)
  const [authError, setAuthError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = (values: RegisterForm) => {
    const result = registerAccount(values.username, values.email, values.password)
    if (!result.success) {
      setAuthError(result.message ?? '创建失败，请稍后重试。')
      return
    }
    navigate('/')
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
      <form className="rounded-md border border-rail bg-white/72 p-5" onSubmit={handleSubmit(onSubmit)}>
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
              autoComplete="new-password"
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
            <UserPlus size={17} aria-hidden="true" />
            创建并进入
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
