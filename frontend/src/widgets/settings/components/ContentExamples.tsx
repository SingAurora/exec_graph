import { useState } from 'react'
import { Accordion, Progress } from 'radix-ui'
import { ChevronDown, RotateCcw } from 'lucide-react'
import previewImage from '../../../../assets/auth-access.png'
import { Avatar } from '../../../shared/ui/Avatar'
import { MarkdownContent } from '../../../shared/ui/MarkdownContent'
import { RecordImages } from '../../../shared/ui/RecordImages'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { ShowcaseCard } from './ShowcaseCard'

/** Demonstrates content organization, document rendering and loading states. */
export function ContentExamples() {
  const [tab, setTab] = useState('record')
  const [progress, setProgress] = useState(35)
  const [loading, setLoading] = useState(true)
  return (
    <>
      <ShowcaseCard name="标签页" term="Tabs" source="项目封装 · Radix UI" description="在同一位置切换不同内容面板，例如设置分类。切换时只显示一个面板。">
        <TabsRoot value={tab} onValueChange={setTab}>
          <TabsList label="演示文档标签页"><TabsTrigger value="record">记录</TabsTrigger><TabsTrigger value="expression">表达</TabsTrigger></TabsList>
          <TabsContent value="record"><p className="pt-3 text-xs leading-[1.8] text-muted">先盛出鸡蛋，番茄炒软后再回锅。静置十分钟，鸡蛋仍能用勺子切开。</p></TabsContent>
          <TabsContent value="expression"><p className="pt-3 text-xs leading-[1.8] text-muted">多洗一个碗可以接受，我更在意放一会儿之后的口感。</p></TabsContent>
        </TabsRoot>
      </ShowcaseCard>
      <ShowcaseCard name="折叠面板" term="Accordion" source="Radix UI 基础组件" description="将次要内容折叠，点击标题展开。适合上下文来源、约定等不必一直展示的内容。">
        <Accordion.Root type="single" collapsible className="divide-y divide-line">{[{ id: 'context', title: '上下文来源', body: '直接承接节点 #10，并合入节点 #4。' }, { id: 'agreement', title: '来源约定', body: '引用时记录实际锅灶条件，不将加热秒数当作通用火候。' }].map((item) => <Accordion.Item value={item.id} key={item.id}><Accordion.Header><Accordion.Trigger className="group flex w-full items-center justify-between gap-3 border-0 bg-transparent py-3 text-left text-xs font-medium outline-none focus-visible:text-signal">{item.title}<ChevronDown size={14} className="shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180" /></Accordion.Trigger></Accordion.Header><Accordion.Content className="pb-3 text-xs leading-[1.8] text-muted">{item.body}</Accordion.Content></Accordion.Item>)}</Accordion.Root>
      </ShowcaseCard>
      <ShowcaseCard name="头像" term="Avatar" source="项目组件" description="标识内容作者或账户。项目内置四种固定尺寸，无图片时使用名字首字。">
        <div className="flex items-end gap-5">{([{ size: 'tiny', label: '24' }, { size: 'small', label: '32' }, { size: 'medium', label: '40' }, { size: 'large', label: '68' }] as const).map(({ size, label }) => <div className="grid justify-items-center gap-2" key={size}><Avatar label="乔" size={size} /><span className="font-sans text-[10px] text-muted">{label}px</span></div>)}</div>
      </ShowcaseCard>
      <ShowcaseCard name="文档排版" term="Markdown Renderer" source="项目组件" description="将 Markdown 显示为正文、列表和强调文字，项目的记录与表达都使用它。">
        <MarkdownContent markdown={'**这次实际做了什么**\n\n鸡蛋先盛出，番茄炒软再回锅。\n\n- 洗菜到装盘 19 分钟\n- 静置后未吃到鸡蛋硬边'} />
      </ShowcaseCard>
      <ShowcaseCard name="图片预览" term="Image Lightbox" source="项目封装 · Radix UI" description="点击缩略图，在遮罩上查看大图，适合行动附图。项目使用 Dialog 实现。">
        <div className="max-w-[240px] [&>div]:mt-0"><RecordImages images={[{ url: previewImage, alt: '项目插画 · 点击预览大图' }]} /></div>
      </ShowcaseCard>
      <ShowcaseCard name="进度条" term="Progress" source="Radix UI 基础组件" description="已知总量时展示进度，例如文件上传。无法确定进度时，不应编造百分比。">
        <div className="flex items-center justify-between gap-3 text-xs"><span>演示上传</span><span className="font-sans text-muted" aria-live="polite">{progress}%</span></div>
        <Progress.Root className="h-1.5 overflow-hidden rounded-full bg-line" value={progress} aria-label="演示上传进度"><Progress.Indicator className="h-full rounded-full bg-signal transition-transform" style={{ transform: `translateX(-${100 - progress}%)` }} /></Progress.Root>
        <div className="mt-1 flex gap-3"><button className="border-0 bg-transparent p-0 text-[11px] font-semibold text-signal disabled:text-muted" type="button" disabled={progress === 100} onClick={() => setProgress((value) => Math.min(100, value + 25))}>推进演示</button><button className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] text-muted" type="button" onClick={() => setProgress(35)}><RotateCcw size={11} />重置</button></div>
      </ShowcaseCard>
      <ShowcaseCard name="骨架屏" term="Skeleton" source="项目样式" description="内容加载时用占位形状保留布局，减少页面跳动；这里只演示加载前后的样式。">
        <div className="min-h-[76px]" aria-busy={loading} aria-label="演示内容">{loading ? <div className="flex gap-3 motion-safe:animate-pulse" role="status"><span className="sr-only">正在加载演示内容</span><span className="size-8 shrink-0 rounded-[9px] bg-line" /><div className="flex-1 space-y-3 pt-1"><div className="h-2.5 w-2/3 rounded bg-line" /><div className="h-2 w-full rounded bg-line/70" /><div className="h-2 w-4/5 rounded bg-line/70" /></div></div> : <div className="flex gap-3"><Avatar label="乔" size="small" /><div><p className="text-xs font-semibold">乔的行动记录</p><p className="mt-2 text-xs leading-[1.8] text-muted">先盛出鸡蛋，番茄炒软后再回锅。</p></div></div>}</div>
        <div><button className="border-0 bg-transparent p-0 text-[11px] font-semibold text-signal" type="button" onClick={() => setLoading((value) => !value)}>{loading ? '显示加载结果' : '重新显示骨架'}</button></div>
      </ShowcaseCard>
    </>
  )
}
