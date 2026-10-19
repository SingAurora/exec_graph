import { useState, type FormEvent } from 'react'
import accessImage from '../../../assets/auth-access.png'
import registerImage from '../../../assets/auth-register.png'
import type { AuthView } from '../../shared/model'

type AuthScreenProps = { view: AuthView; onEnter: () => void }

const copy = {
  login: { title: '欢迎回来', intro: '记录做过的事，让表达有迹可循。', submit: '进入演示' },
  register: { title: '创建账号', intro: '当前体验演示账号，注册服务暂未接入。', submit: '体验演示账号' },
  forgot: { title: '找回密码', intro: '当前为演示站点，暂未接入密码找回服务。', submit: '查看服务状态' },
} satisfies Record<AuthView, { title: string; intro: string; submit: string }>

export function AuthScreen({ view, onEnter }: AuthScreenProps) {
  const [submitted, setSubmitted] = useState(false)
  const isRegister = view === 'register'
  const content = copy[view]
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); if (view !== 'forgot') onEnter() }

  return <main className="mx-auto grid min-h-screen w-[min(1120px,calc(100%-72px))] grid-cols-[minmax(0,1fr)_minmax(390px,.82fr)] items-center gap-[clamp(48px,8vw,120px)] max-[820px]:grid-cols-1 max-[820px]:gap-7 max-[820px]:w-[min(100%,520px)] max-[820px]:px-[18px] max-[820px]:py-7 max-[480px]:gap-[22px] max-[480px]:pt-[18px]" aria-label="账户访问"><section className="grid min-h-[620px] place-items-center overflow-hidden rounded-[18px] px-[clamp(28px,5vw,78px)] py-[58px] max-[820px]:min-h-0 max-[820px]:rounded-[14px] max-[820px]:p-7 max-[480px]:p-5" aria-hidden="true"><img className="block h-auto w-[min(100%,330px)] max-[820px]:max-h-[220px] max-[820px]:object-contain max-[480px]:max-h-[175px]" src={isRegister ? registerImage : accessImage} alt="" /></section><div className="mx-auto w-[min(100%,420px)] max-[820px]:w-full">
    <a className="flex items-center gap-2.5 font-bold" href="#my"><span className="grid size-[30px] place-items-center rounded-[9px] bg-signal font-sans text-[15px] text-white">E</span><span>ExAct</span></a><section className="mt-8 rounded-[10px] border border-line bg-surface p-8 shadow-[0_14px_40px_rgb(28_48_40_/_0.06)] max-[480px]:px-5 max-[480px]:py-[25px]" aria-labelledby="auth-title"><h1 id="auth-title" className="font-sans text-[25px] tracking-[-.03em]">{content.title}</h1><p className="mt-2 text-[13px] leading-[1.7] text-muted">{content.intro}</p>
      <form className="mt-[25px] grid gap-4" onSubmit={submit}>
        {isRegister && <div className="grid gap-[7px]"><label className="text-xs font-semibold text-muted" htmlFor="register-name">昵称</label><input className="h-[42px] w-full rounded-md border border-line bg-transparent px-3 text-ink outline-none transition focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.12)]" id="register-name" required type="text" placeholder="怎么称呼你" /><span className="text-[11px] leading-[1.5] text-muted">昵称需唯一，之后会显示在你的行动记录中。</span></div>}
        <div className="grid gap-[7px]"><label className="text-xs font-semibold text-muted" htmlFor="auth-email">邮箱</label><input className="h-[42px] w-full rounded-md border border-line bg-transparent px-3 text-ink outline-none transition focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.12)]" id="auth-email" required type="email" autoComplete="email" placeholder="you@example.com" /></div>
        {view !== 'forgot' && <div className="grid gap-[7px]"><div className="flex items-center justify-between gap-3"><label className="text-xs font-semibold text-muted" htmlFor="auth-password">密码</label>{view === 'login' && <a className="text-[11px] font-semibold text-signal hover:text-signal-dark" href="#forgot">忘记密码？</a>}</div><input className="h-[42px] w-full rounded-md border border-line bg-transparent px-3 text-ink outline-none transition focus:border-signal focus:shadow-[0_0_0_3px_rgb(35_107_89_/_0.12)]" id="auth-password" required type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? '设置密码' : '输入密码'} /></div>}
        <button className="mt-0.5 min-h-[42px] rounded-md border-0 bg-signal text-[13px] font-bold text-white transition hover:bg-signal-dark" type="submit">{content.submit}</button>
      </form>
      {submitted && view === 'forgot' && <p className="mt-2 text-sm leading-6 text-muted" role="status">暂未发送邮件，可返回登录页进入演示。</p>}
      {view === 'login' && <p className="mt-[22px] text-center text-xs text-muted">还没有账号？ <a className="font-bold text-signal" href="#register">注册账号</a></p>}
      {view === 'register' && <p className="mt-[22px] text-center text-xs text-muted">已经有账号？ <a className="font-bold text-signal" href="#login">返回登录</a></p>}
      {view === 'forgot' && <p className="mt-[22px] text-center text-xs text-muted"><a className="font-bold text-signal" href="#login">返回登录</a></p>}
      {view === 'login' && <a className="mt-4 block text-center text-xs text-muted hover:text-signal" href="#my">直接进入演示</a>}
    </section></div></main>
}
