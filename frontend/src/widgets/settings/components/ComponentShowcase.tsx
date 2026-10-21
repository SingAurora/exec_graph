import { useState } from 'react'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../../shared/ui/tabs/Tabs'
import { OverlayExamples } from './OverlayExamples'
import { InputExamples } from './InputExamples'
import { ContentExamples } from './ContentExamples'

/** Interactive catalog of existing components and styled Radix building blocks. */
export function ComponentShowcase() {
  const [category, setCategory] = useState('overlays')
  return <div className="mt-6 pb-8">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">组件目录</h3><span className="text-[11px] text-muted">19 种组件示例</span>
    </div>
    <p className="mt-2 text-xs leading-[1.8] text-muted">项目封装可直接复用；Radix UI 基础组件已安装，这里适配项目样式，接入业务时可再封装。所有操作仅作用于演示。</p>
    <TabsRoot value={category} onValueChange={setCategory}>
      <TabsList label="组件分类">
        <TabsTrigger value="overlays">浮层与反馈 · 6</TabsTrigger>
        <TabsTrigger value="inputs">输入与选择 · 6</TabsTrigger>
        <TabsTrigger value="content">内容展示 · 7</TabsTrigger>
      </TabsList>
      <TabsContent value="overlays"><div className="mt-5 grid grid-cols-2 gap-4"><OverlayExamples /></div></TabsContent>
      <TabsContent value="inputs"><div className="mt-5 grid grid-cols-2 gap-4"><InputExamples /></div></TabsContent>
      <TabsContent value="content"><div className="mt-5 grid grid-cols-2 gap-4"><ContentExamples /></div></TabsContent>
    </TabsRoot>
  </div>
}
