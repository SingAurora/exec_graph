import { Check, Moon, Sun } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { GraphBackgroundSettings } from '../../features/graph-appearance/ui/GraphBackgroundSettings'
import type { GraphBackgroundPreferences } from '../../shared/ui/graph-background/model'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'

type AppearanceSettingsProps = {
  darkMode: boolean
  onToggleTheme: () => void
  graphBackground: GraphBackgroundPreferences
  onGraphBackgroundChange: (preferences: GraphBackgroundPreferences) => void
  showActionGraphLegend: boolean
  onShowActionGraphLegendChange: (show: boolean) => void
}

/** Immediate appearance preferences with explicit theme choices and a live canvas preview. */
export function AppearanceSettings({ darkMode, onToggleTheme, graphBackground, onGraphBackgroundChange, showActionGraphLegend, onShowActionGraphLegendChange }: AppearanceSettingsProps) {
  return (
    <div className="mt-6 max-w-[880px] pb-8">
      <section className="flex items-center justify-between gap-8" aria-labelledby="interface-theme-title">
        <h2 id="interface-theme-title" className="text-base font-semibold">界面主题</h2>
        <RadioGroup.Root className="grid w-52 max-w-full grid-cols-2 gap-2" aria-label="界面主题" value={darkMode ? 'dark' : 'light'} onValueChange={(value) => { if ((value === 'dark') !== darkMode) onToggleTheme() }}>
          {[{ value: 'light', label: '浅色', icon: Sun }, { value: 'dark', label: '深色', icon: Moon }].map(({ value, label, icon: Icon }) => <RadioGroup.Item key={value} value={value} className="group flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm font-medium text-muted transition-colors hover:border-signal/50 data-[state=checked]:border-signal data-[state=checked]:bg-signal-soft data-[state=checked]:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            <Icon size={15} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span>
            <RadioGroup.Indicator className="ml-auto"><Check size={12} aria-hidden="true" /></RadioGroup.Indicator>
          </RadioGroup.Item>)}
        </RadioGroup.Root>
      </section>
      <section className="mt-7 border-t border-line pt-5" aria-labelledby="graph-appearance-title">
        <div className="mb-4 flex items-center gap-1">
          <h2 id="graph-appearance-title" className="text-base font-semibold">行动节点图</h2>
          <HelpPopover title="节点图外观">
            <p>背景和图例应用于所有行动图，仅影响你的浏览界面。修改立即生效，并在当前浏览器保存，无需另外提交。</p>
            <p>每种背景分别保留纹理参数。恢复默认会重置全部背景样式和参数，不改变图例开关。</p>
          </HelpPopover>
        </div>
        <GraphBackgroundSettings preferences={graphBackground} onChange={onGraphBackgroundChange} showLegend={showActionGraphLegend} onShowLegendChange={onShowActionGraphLegendChange} />
      </section>
    </div>
  )
}
