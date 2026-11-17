import { Check, Moon, Sun } from 'lucide-react'
import { RadioGroup } from 'radix-ui'
import { GraphBackgroundSettings } from '../../features/graph-appearance/ui/GraphBackgroundSettings'
import { HelpPopover } from '../../shared/ui/help/HelpPopover'
import type { GraphBackgroundPreferences } from '../../shared/ui/graph-background/model'
import { useAppearanceStore, type Theme } from '../../features/appearance/model/appearance-store'



const themeOptions = [
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
] as const

type AppearanceSettingsViewProps = {
    theme: Theme
    onThemeChange: (theme: Theme) => void
    graphBackground: GraphBackgroundPreferences
    onGraphBackgroundChange: (preferences: GraphBackgroundPreferences) => void
    showActionGraphLegend: boolean
    onShowActionGraphLegendChange: (show: boolean) => void
}

/** 外观设置的纯展示组件；真实页面由 AppearanceSettings 注入全局 store。 */
export function AppearanceSettingsView({
                                           theme,
                                           onThemeChange,
                                           graphBackground,
                                           onGraphBackgroundChange,
                                           showActionGraphLegend,
                                           onShowActionGraphLegendChange,
                                       }: AppearanceSettingsViewProps) {

    return (
        <div className="mt-6 max-w-[880px] pb-8">
            <section className="flex items-center justify-between gap-8">
                <h2 id="interface-theme-title" className="text-base font-semibold">界面主题</h2>
                <RadioGroup.Root
                    className="grid w-52 max-w-full grid-cols-2 gap-2"
                    value={theme}
                    onValueChange={(value) => onThemeChange(value as Theme)}
                >
                    {themeOptions.map((option) => {
                        const Icon = option.icon

                        return (
                            <RadioGroup.Item
                                key={option.value}
                                value={option.value}
                                className="group flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm font-medium text-muted transition-colors hover:border-signal/50 data-[state=checked]:border-signal data-[state=checked]:bg-signal-soft data-[state=checked]:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                            >
                                <Icon size={15} strokeWidth={1.6} />
                                <span>{option.label}</span>
                                <RadioGroup.Indicator className="ml-auto">
                                    <Check size={12} />
                                </RadioGroup.Indicator>
                            </RadioGroup.Item>
                        )
                    })}
                </RadioGroup.Root>
            </section>
            <section className="mt-7 border-t border-line pt-5">
                <div className="mb-4 flex items-center gap-1">
                    <h2 id="graph-appearance-title" className="text-base font-semibold">节点关系图</h2>
                    <HelpPopover title="节点图外观">
                        <p>背景和图例应用于所有行动图，仅影响你的浏览界面。修改立即生效，并在当前浏览器保存，无需另外提交。</p>
                        <p>每种背景分别保留纹理参数。恢复默认会重置全部背景样式和参数，不改变图例开关。</p>
                    </HelpPopover>
                </div>
                <GraphBackgroundSettings
                    preferences={graphBackground}
                    onChange={onGraphBackgroundChange}
                    showLegend={showActionGraphLegend}
                    onShowLegendChange={onShowActionGraphLegendChange}
                />
            </section>
        </div>
    )
}


/** 从全局外观 store 读取设置，避免从 App 一层层传 props。 */
export function AppearanceSettings() {
    const theme = useAppearanceStore((state) => state.theme)
    const onThemeChange = useAppearanceStore((state) => state.setTheme)
    const graphBackground = useAppearanceStore((state) => state.graphBackground)
    const onGraphBackgroundChange = useAppearanceStore((state) => state.setGraphBackground)
    const showActionGraphLegend = useAppearanceStore((state) => state.showActionGraphLegend)
    const onShowActionGraphLegendChange = useAppearanceStore((state) => state.setShowActionGraphLegend)

    return (
        <AppearanceSettingsView
            theme={theme}
            onThemeChange={onThemeChange}
            graphBackground={graphBackground}
            onGraphBackgroundChange={onGraphBackgroundChange}
            showActionGraphLegend={showActionGraphLegend}
            onShowActionGraphLegendChange={onShowActionGraphLegendChange}
        />
    )
}
