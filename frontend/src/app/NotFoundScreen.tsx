import { ArrowLeft } from 'lucide-react'
import { AppBackdrop } from '../widgets/layout/AppBackdrop'
import { Brand } from '../shared/ui/Brand'
import { SiteFooter } from '../shared/ui/SiteFooter'

/** 未匹配任何应用或认证路由时的独立页面。 */
export function NotFoundScreen() {
  return (
    <main className="relative isolate grid min-h-dvh place-content-center bg-paper px-6 py-16 text-center">
      <AppBackdrop />
      <div className="relative mx-auto flex w-[min(420px,100%)] flex-col items-center gap-5">
        <a className="rounded-sm" href="#home" title="引序 公开内容"><Brand /></a>
        <p className="text-6xl font-semibold tracking-tight text-signal">404</p>
        <div className="grid gap-2">
          <h1 className="text-xl font-semibold text-ink">页面不存在</h1>
          <p className="text-sm leading-6 text-muted">这个地址可能已经失效，或者链接输入有误。</p>
        </div>
        <a className="quiet-button" href="#home"><ArrowLeft size={15} />返回公开内容</a>
        <SiteFooter className="mt-4" />
      </div>
    </main>
  )
}
