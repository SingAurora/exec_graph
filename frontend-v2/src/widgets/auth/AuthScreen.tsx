import { useState, type FormEvent } from 'react'
import accessImage from '../../../assets/auth-access.png'
import registerImage from '../../../assets/auth-register.png'
import type { AuthView } from '../../shared/model'

type AuthScreenProps = { view: AuthView; onEnter: () => void }

const copy = {
  login: { title: '欢迎回来', intro: '登录后继续记录正在发生的事情。', submit: '登录' },
  register: { title: '创建账号', intro: '从一件小事开始，留下你的行动。', submit: '注册' },
  forgot: { title: '找回密码', intro: '输入邮箱，我们会发送重置密码的邮件。', submit: '发送重置邮件' },
} satisfies Record<AuthView, { title: string; intro: string; submit: string }>

export function AuthScreen({ view, onEnter }: AuthScreenProps) {
  const [submitted, setSubmitted] = useState(false)
  const isRegister = view === 'register'
  const content = copy[view]
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); if (view !== 'forgot') onEnter() }

  return <main className="auth-shell"><section className="auth-visual" aria-hidden="true"><img className="auth-character-image" src={isRegister ? registerImage : accessImage} alt="" /></section><div className="auth-panel">
    <a className="auth-brand" href="#my"><span className="brand-mark">E</span><span>ExecG</span></a><section className="auth-card" aria-labelledby="auth-title"><h1 id="auth-title">{content.title}</h1><p className="auth-intro">{content.intro}</p>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <div className="field"><label htmlFor="register-name">昵称</label><input id="register-name" required type="text" placeholder="怎么称呼你" /><span className="field-hint">昵称需唯一，之后会显示在你的行动记录中。</span></div>}
        <div className="field"><label htmlFor="auth-email">邮箱</label><input id="auth-email" required type="email" autoComplete="email" placeholder="you@example.com" /></div>
        {view !== 'forgot' && <div className="field"><div className="field-header"><label htmlFor="auth-password">密码</label>{view === 'login' && <a href="#forgot">忘记密码？</a>}</div><input id="auth-password" required type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? '设置密码' : '输入密码'} /></div>}
        <button className="auth-submit" type="submit">{content.submit}</button>
      </form>
      {submitted && view === 'forgot' && <p className="auth-intro">重置邮件已发送，请查看邮箱。</p>}
      {view === 'login' && <p className="auth-switch">还没有账号？ <a href="#register">注册账号</a></p>}
      {view === 'register' && <p className="auth-switch">已经有账号？ <a href="#login">返回登录</a></p>}
      {view === 'forgot' && <p className="auth-switch"><a href="#login">返回登录</a></p>}
      {view === 'login' && <a className="auth-demo" href="#my">直接进入演示</a>}
    </section></div></main>
}
