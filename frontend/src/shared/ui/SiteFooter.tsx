/** 站点备案信息；备案号链接到工信部备案系统。 */
export function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-[11px] leading-5 text-muted ${className}`}>
      <a
        className="rounded-sm transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-signal"
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noreferrer"
        title="工业和信息化部备案管理系统"
      >
        闽ICP备2026045101号
      </a>
    </footer>
  )
}
