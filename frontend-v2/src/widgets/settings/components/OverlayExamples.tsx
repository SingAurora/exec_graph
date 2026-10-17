import { useRef, useState } from 'react'
import { AlertDialog, DropdownMenu } from 'radix-ui'
import { ArrowUpRight, Check, Ellipsis, GitBranch, Info } from 'lucide-react'
import { Dialog } from '../../../shared/ui/dialog/Dialog'
import { HelpPopover } from '../../../shared/ui/help/HelpPopover'
import { Tooltip } from '../../../shared/ui/tooltip/Tooltip'
import { useToast } from '../../../shared/ui/toast/useToast'
import { ShowcaseCard } from './ShowcaseCard'

const menuItemClass = 'flex cursor-default items-center gap-2 rounded px-3 py-2 text-xs text-ink outline-none data-[highlighted]:bg-soft data-[highlighted]:text-signal'

/** Demonstrates anchored overlays, modal workflows and transient feedback. */
export function OverlayExamples() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('下班后复做了一盘番茄炒蛋')
  const [savedTitle, setSavedTitle] = useState(title)
  const [confirmed, setConfirmed] = useState(false)
  const [menuAction, setMenuAction] = useState('尚未选择')
  const dialogTrigger = useRef<HTMLButtonElement>(null)
  const { showToast } = useToast()

  return <>
    <ShowcaseCard name="气泡浮层" term="Popover" source="项目封装 · Radix UI" description="点击后在按钮附近展开补充内容，适合问号帮助、规则说明。">
      <div className="flex items-center gap-2 text-xs"><span>节点关系</span><HelpPopover title="气泡浮层示例"><p>这是产品中正在使用的问号帮助组件。内容可以包含多段文字，也可以放操作控件。</p><p>点击外部、关闭按钮或按 Esc 收起。</p></HelpPopover></div>
      <p className="text-[11px] text-muted">点击问号查看说明</p>
    </ShowcaseCard>

    <ShowcaseCard name="悬浮提示" term="Tooltip" source="项目封装 · Radix UI" description="鼠标悬浮或键盘聚焦时显示一句短提示，适合说明图标按钮。">
      <div><Tooltip content="查看来源节点"><button className="icon-button" type="button" aria-label="查看来源节点示例"><ArrowUpRight size={16} /></button></Tooltip></div>
      <p className="text-[11px] text-muted">悬浮在图标上，或用 Tab 聚焦</p>
    </ShowcaseCard>

    <ShowcaseCard name="模态对话框" term="Dialog / Modal" source="项目封装 · Radix UI" description="居中展开并暂时隔开底层页面，适合编辑表单、发起行动图等完整操作。">
      <div><button ref={dialogTrigger} className="quiet-button" type="button" onClick={() => { setTitle(savedTitle); setDialogOpen(true) }}>编辑演示标题</button></div>
      <p className="truncate text-[11px] text-muted" aria-live="polite">{savedTitle}</p>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="编辑演示标题" description="修改标题后保存，仅更新组件演示。" returnFocusRef={dialogTrigger}>
        <form className="mt-5 grid gap-4" onSubmit={(event) => { event.preventDefault(); setSavedTitle(title.trim()); setDialogOpen(false) }}>
          <label className="grid gap-2 text-xs">标题<input className="h-9 rounded-md border border-line bg-transparent px-3 text-xs outline-none focus:border-signal" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="flex justify-end gap-2"><button className="quiet-button" type="button" onClick={() => setDialogOpen(false)}>取消</button><button className="primary-button" type="submit" disabled={!title.trim()}>保存</button></div>
        </form>
      </Dialog>
    </ShowcaseCard>

    <ShowcaseCard name="确认对话框" term="Alert Dialog" source="Radix UI 基础组件" description="需要用户明确确认或取消的模态框，适合移除引用等需要慎重决定的操作。">
      <AlertDialog.Root>
        <div><AlertDialog.Trigger asChild><button className="quiet-button" type="button">演示确认操作</button></AlertDialog.Trigger></div>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 text-ink shadow-app outline-none">
            <AlertDialog.Title className="text-base font-semibold">确认执行演示操作？</AlertDialog.Title>
            <AlertDialog.Description className="mt-3 text-xs leading-[1.8] text-muted">确认后会更新卡片里的演示状态。此类对话框要求明确选择，点击遮罩不会关闭。</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2"><AlertDialog.Cancel asChild><button className="quiet-button" type="button">取消</button></AlertDialog.Cancel><AlertDialog.Action asChild><button className="primary-button" type="button" onClick={() => setConfirmed(true)}>确认</button></AlertDialog.Action></div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <div className="flex items-center gap-3 text-[11px] text-muted" aria-live="polite"><span>{confirmed ? '已确认演示操作' : '尚未确认'}</span>{confirmed && <button className="border-0 bg-transparent p-0 text-signal" type="button" onClick={() => setConfirmed(false)}>重置</button>}</div>
    </ShowcaseCard>

    <ShowcaseCard name="下拉操作菜单" term="Dropdown Menu" source="Radix UI 基础组件" description="收纳针对当前对象的多个操作，适合节点右上角的“更多”。">
      <DropdownMenu.Root>
        <div><DropdownMenu.Trigger asChild><button className="quiet-button gap-2" type="button"><Ellipsis size={15} />更多操作</button></DropdownMenu.Trigger></div>
        <DropdownMenu.Portal><DropdownMenu.Content className="z-50 min-w-[168px] rounded-md border border-line bg-surface p-1 shadow-app" sideOffset={6}>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => setMenuAction('查看来源')}><ArrowUpRight size={14} />查看来源</DropdownMenu.Item>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => setMenuAction('另开支链')}><GitBranch size={14} />另开支链</DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={menuItemClass} onSelect={() => setMenuAction('标记已读')}><Check size={14} />标记已读</DropdownMenu.Item>
        </DropdownMenu.Content></DropdownMenu.Portal>
      </DropdownMenu.Root>
      <p className="text-[11px] text-muted" aria-live="polite">{menuAction}</p>
    </ShowcaseCard>

    <ShowcaseCard name="短时通知" term="Toast" source="项目封装 · Radix UI" description="操作后短暂出现并自动消失，适合保存结果、警告和失败反馈。">
      <div className="flex flex-wrap gap-2">
        <button className="quiet-button" type="button" onClick={() => showToast({ kind: 'info', message: '演示：记录已保存。' })}><Info size={13} className="mr-1.5" />提示</button>
        <button className="quiet-button !text-warning" type="button" onClick={() => showToast({ kind: 'warning', message: '演示：约定尚未核对。' })}>警告</button>
        <button className="quiet-button !text-coral" type="button" onClick={() => showToast({ kind: 'error', message: '演示：保存失败，请重试。' })}>错误</button>
      </div>
      <p className="text-[11px] text-muted">通知出现在页面顶部，不打断当前操作</p>
    </ShowcaseCard>
  </>
}
