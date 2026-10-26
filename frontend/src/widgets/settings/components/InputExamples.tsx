import { useId, useState } from 'react'
import { Checkbox, RadioGroup, Switch } from 'radix-ui'
import { Check, Plus } from 'lucide-react'
import { Select } from '../../../shared/ui/select/Select'
import { ShowcaseCard } from './ShowcaseCard'

/** Demonstrates form controls with local, disposable example values. */
export function InputExamples() {
  const id = useId()
  const [pressed, setPressed] = useState(false)
  const [name, setName] = useState('番茄炒蛋练习')
  const [note, setNote] = useState('鸡蛋先盛出，番茄炒软后再回锅。')
  const [sort, setSort] = useState('newest')
  const [checked, setChecked] = useState<Checkbox.CheckedState>(false)
  const [document, setDocument] = useState('record')
  const [enabled, setEnabled] = useState(true)
  return (
    <>
      <ShowcaseCard name="按钮" term="Button / Icon Button" source="项目样式" description="主按钮突出主要动作；次按钮与文字按钮降低层级；图标按钮节省空间。">
        <div className="flex flex-wrap items-center gap-2"><button className="primary-button" type="button" onClick={() => setPressed(true)}>主要操作</button><button className="quiet-button" type="button" onClick={() => setPressed(false)}>次要操作</button><button className="border-0 bg-transparent px-2 py-1 text-xs font-semibold text-signal" type="button" onClick={() => setPressed(false)}>文字按钮</button><button className="icon-button" type="button" title="添加演示内容" onClick={() => setPressed(true)}><Plus size={15} /></button></div>
        <div className="flex items-center gap-3"><button className="quiet-button cursor-not-allowed opacity-40" type="button" disabled>不可用</button><span className="text-[11px] text-muted">{pressed ? '已执行主要操作' : '等待操作'}</span></div>
      </ShowcaseCard>
      <ShowcaseCard name="文本输入" term="Input / Textarea" source="原生控件" description="Input 输入一行内容，Textarea 输入多行内容。标签说明字段，提示文字提供示例。">
        <label className="grid gap-1.5 text-[11px] text-muted">行动图名称<input className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-xs text-ink outline-none focus:border-signal" value={name} onChange={(event) => setName(event.target.value)} placeholder="填写行动图名称" /></label>
        <label className="grid gap-1.5 text-[11px] text-muted">补充内容<textarea className="min-h-16 w-full resize-y rounded-md border border-line bg-surface px-2.5 py-2 text-xs leading-[1.7] text-ink outline-none focus:border-signal" value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下补充内容" rows={2} /></label>
      </ShowcaseCard>
      <ShowcaseCard name="下拉选择器" term="Select" source="项目封装 · Radix UI" description="从固定选项中选择一个值，适合排序、性别等字段。它选择值，不执行菜单动作。">
        <div><Select label="演示排序方式" value={sort} onValueChange={setSort} className="!border !border-line !bg-surface" options={[{ value: 'newest', label: '最新发布' }, { value: 'oldest', label: '最早发布' }, { value: 'depth', label: '节点层级' }]} /></div>
        <p className="text-[11px] text-muted">切换后显示当前选项</p>
      </ShowcaseCard>
      <ShowcaseCard name="复选框" term="Checkbox" source="Radix UI 基础组件" description="表示独立的勾选项，一组选项可以选多个；也适合在提交前确认已阅读约定。">
        <div className="flex items-center gap-2.5"><Checkbox.Root id={`${id}-agreement`} checked={checked} onCheckedChange={setChecked} className="grid size-4 shrink-0 place-items-center rounded-[3px] border border-line bg-surface text-white outline-none data-[state=checked]:border-signal data-[state=checked]:bg-signal focus-visible:ring-2 focus-visible:ring-signal/25"><Checkbox.Indicator><Check size={12} /></Checkbox.Indicator></Checkbox.Root><label htmlFor={`${id}-agreement`} className="cursor-pointer text-xs">我已阅读来源约定</label></div>
        <p className="text-[11px] text-muted">{checked ? '已勾选' : '未勾选'}</p>
      </ShowcaseCard>
      <ShowcaseCard name="单选组" term="Radio Group" source="Radix UI 基础组件" description="在一组互斥选项中只选一个，选项少时可全部展开，方便比较。">
        <RadioGroup.Root className="flex flex-wrap gap-5" value={document} onValueChange={setDocument}>{[{ value: 'record', label: '记录' }, { value: 'expression', label: '表达' }].map((option) => <div className="flex items-center gap-2" key={option.value}><RadioGroup.Item id={`${id}-${option.value}`} value={option.value} className="grid size-4 shrink-0 place-items-center rounded-full border border-line bg-surface outline-none data-[state=checked]:border-signal focus-visible:ring-2 focus-visible:ring-signal/25"><RadioGroup.Indicator className="size-2 rounded-full bg-signal" /></RadioGroup.Item><label htmlFor={`${id}-${option.value}`} className="cursor-pointer text-xs">{option.label}</label></div>)}</RadioGroup.Root>
        <p className="text-[11px] text-muted">示例：选择默认阅读哪一份文档</p>
      </ShowcaseCard>
      <ShowcaseCard name="开关" term="Switch" source="Radix UI 基础组件" description="表示立即生效的开或关，适合界面偏好。复选框更适合需要一起提交的表单选项。">
        <div className="flex items-center justify-between gap-3"><label htmlFor={`${id}-preview`} className="cursor-pointer text-xs">显示悬浮预览</label><Switch.Root id={`${id}-preview`} checked={enabled} onCheckedChange={setEnabled} className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 bg-line p-0.5 outline-none transition-colors data-[state=checked]:bg-signal focus-visible:ring-2 focus-visible:ring-signal/25"><Switch.Thumb className="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" /></Switch.Root></div>
        <p className="text-[11px] text-muted">{enabled ? '已开启' : '已关闭'}</p>
      </ShowcaseCard>
    </>
  )
}
