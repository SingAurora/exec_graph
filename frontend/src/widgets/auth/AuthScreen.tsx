import { useRef, useState, type FormEvent, type FocusEvent } from 'react'
import { CircleAlert, Eye, EyeOff, Moon, Sun } from 'lucide-react'
import accessImage from '../../../assets/auth-mountain-walk.jpg'
import registerImage from '../../../assets/auth-valley-hike.jpg'
import type { AuthView } from '../../shared/model'
import { validateAuthField, validateAuthForm, type AuthFieldErrors, type AuthFieldName } from '../../features/auth/lib/validation'
import { Brand } from '../../shared/ui/Brand'
import { useToast } from '../../shared/ui/toast/useToast'
import './auth-screen.css'

type AuthScreenProps = {
  view: AuthView
  darkMode: boolean
  onToggleTheme: () => void
  onEnter: () => void
}

const copy = {
  login: { title: '欢迎回来', intro: '登录引序，接着留下你的行动。', submit: '登录' },
  register: { title: '创建账号', intro: '从你的第一次行动开始。', submit: '创建账号' },
  forgot: { title: '找回密码', intro: '验证邮箱后，设置新的密码。', submit: '重设密码' },
} satisfies Record<AuthView, { title: string; intro: string; submit: string }>

/** Account entry with a photographic scene and the shared application theme. */
export function AuthScreen({ view, darkMode, onToggleTheme, onEnter }: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<AuthFieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)
  const { showToast } = useToast()
  const isRegister = view === 'register'
  const isLogin = view === 'login'
  const content = copy[view]
  const themeLabel = darkMode ? '切换浅色模式' : '切换深色模式'
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateAuthForm(view, new FormData(event.currentTarget))
    setErrors(nextErrors)
    const firstError = Object.keys(nextErrors)[0]
    if (firstError) {
      const input = event.currentTarget.elements.namedItem(firstError)
      if (input instanceof HTMLInputElement) input.focus()
      return
    }
    showToast({ message: '账户服务暂未接入，可点击「体验演示」浏览网站。', kind: 'info' })
  }
  const sendCode = () => {
    const input = formRef.current?.elements.namedItem('email')
    if (!(input instanceof HTMLInputElement)) return
    const error = validateAuthField(view, 'email', input.value)
    setErrors((current) => ({ ...current, email: error }))
    if (error) {
      input.focus()
      return
    }
    showToast({ message: '验证码服务暂未接入，未发送邮件。', kind: 'info' })
  }
  const updateError = (event: FormEvent<HTMLFormElement> | FocusEvent<HTMLFormElement>) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const name = input.name as AuthFieldName
    // Wait until blur to flag a new error; revalidate existing errors as the user edits.
    if (!errors[name] && (event.type !== 'blur' || !input.value)) return
    setErrors((current) => ({ ...current, [name]: validateAuthField(view, name, input.value) }))
  }
  const feedbackProps = (name: AuthFieldName) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': `auth-${name}-error`,
  })

  return <main className="auth-layout" aria-label="账户访问">
    <section className="auth-scene" aria-label="引序">
      <img className={`auth-scene-photo${isRegister ? ' auth-scene-photo-register' : ''}`}
        src={isRegister ? registerImage : accessImage}
        alt={isRegister ? '徒步者沿着山谷里的小路向远处行走' : '一个人走在山野中，远处是薄雾笼罩的群山'} />
      <a className="auth-brand" href="#login" aria-label="引序 登录"><Brand tone="inverse" /></a>
    </section>
    <section className="auth-account" aria-labelledby="auth-title">
      <button className="auth-appearance" type="button" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
        {darkMode ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <div className="auth-form-shell">
        <h1 id="auth-title" className="auth-title">{content.title}</h1>
        <p className="auth-intro">{content.intro}</p>
        <form ref={formRef} className="auth-form" noValidate onSubmit={submit} onBlur={updateError} onChange={updateError}>
          {isRegister && <div className="auth-field">
            <label htmlFor="auth-name">昵称</label>
            <input id="auth-name" name="nickname" required maxLength={30} autoComplete="nickname" placeholder="怎么称呼你" {...feedbackProps('nickname')} />
            <FieldFeedback name="nickname" error={errors.nickname} />
          </div>}
          <div className="auth-field">
            <label htmlFor="auth-email">邮箱</label>
            <input id="auth-email" name="email" required type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="输入邮箱地址" {...feedbackProps('email')} />
            <FieldFeedback name="email" error={errors.email} />
          </div>
          {!isLogin && <div className="auth-field">
            <label htmlFor="auth-code">邮箱验证码</label>
            <div className="auth-code-row">
              <input id="auth-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6 位验证码" {...feedbackProps('code')} />
              <button className="auth-send" type="button" onClick={sendCode}>发送验证码</button>
            </div>
            <FieldFeedback name="code" error={errors.code} />
          </div>}
          <div className="auth-field">
            <div className="auth-label-line">
              <label htmlFor="auth-password">{view === 'forgot' ? '新密码' : '密码'}</label>
              {isLogin && <a href="#forgot">忘记密码？</a>}
            </div>
            <div className="auth-password">
              <input id="auth-password" name="password" required type={showPassword ? 'text' : 'password'}
                minLength={isLogin ? 1 : 8} autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder={isLogin ? '输入密码' : '设置至少 8 位密码'} {...feedbackProps('password')} />
              <button className="auth-eye" type="button" onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <FieldFeedback name="password" error={errors.password} />
          </div>
          <button className="auth-submit" type="submit">{content.submit}</button>
        </form>
        <p className="auth-switcher">
          {isLogin ? '还没有账号？' : isRegister ? '已经有账号？' : '想起密码了？'}
          <a href={isLogin ? '#register' : '#login'}>{isLogin ? '注册账号' : '返回登录'}</a>
        </p>
        <button className="auth-demo" type="button" onClick={onEnter}>体验演示</button>
      </div>
    </section>
  </main>
}

function FieldFeedback({ name, error }: { name: AuthFieldName; error?: string }) {
  return <p id={`auth-${name}-error`} className="auth-field-feedback" aria-live="polite" aria-atomic="true">
    {error && <><CircleAlert size={13} aria-hidden="true" /><span>{error}</span></>}
  </p>
}
