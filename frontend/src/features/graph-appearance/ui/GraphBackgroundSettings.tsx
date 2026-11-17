import { RotateCcw } from 'lucide-react'
import { useId } from 'react'
import { GraphBackground } from '../../../shared/ui/graph-background/GraphBackground'
import {
    createDefaultGraphBackground,
    type GraphBackgroundPreferences,
    type GraphBackgroundStyle,
    type GraphPatternIntensity,
} from '../../../shared/ui/graph-background/model'
import { GraphAppearancePreview } from './GraphAppearancePreview'

type GraphBackgroundSettingsProps = {
    preferences: GraphBackgroundPreferences
    onChange: (preferences: GraphBackgroundPreferences) => void
    showLegend: boolean
    onShowLegendChange: (show: boolean) => void
}

type StyleOption = {
    value: GraphBackgroundStyle
    label: string
}

type IntensityOption = {
    value: GraphPatternIntensity
    label: string
}

/** 可选的行动图背景样式。 */
const styleOptions: StyleOption[] = [
    { value: 'plain', label: '纯色' },
    { value: 'dots', label: '点阵' },
    { value: 'grid', label: '细线网格' },
    { value: 'crosses', label: '十字网格' },
]

/** 纹理相对于当前主题的深浅程度。 */
const intensityOptions: IntensityOption[] = [
    { value: 'light', label: '浅' },
    { value: 'standard', label: '标准' },
    { value: 'strong', label: '明显' },
]

/**
 * 编辑本机行动图背景偏好。
 * 所有修改立即通过 onChange 写回父组件，由父组件保存到 localStorage。
 */
export function GraphBackgroundSettings({
                                             preferences,
                                             onChange,
                                             showLegend,
                                             onShowLegendChange,
                                         }: GraphBackgroundSettingsProps) {
    const groupId = useId()
    // 纯色没有纹理配置，其余样式各自保存一套参数。
    const patternStyle = preferences.style === 'plain' ? undefined : preferences.style
    const pattern = patternStyle ? preferences[patternStyle] : undefined
    const isDefault = JSON.stringify(preferences) === JSON.stringify(createDefaultGraphBackground())

    /** 只更新当前纹理样式的公共参数；纯色没有纹理，直接忽略。 */
    const updatePattern = (patch: {
        spacing?: number
        intensity?: GraphPatternIntensity
    }) => {
        if (!patternStyle) return

        onChange({
            ...preferences,
            [patternStyle]: {
                ...preferences[patternStyle],
                ...patch,
            },
        })
    }

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-8 max-[1000px]:grid-cols-1">
            <div className="grid min-w-0 gap-5">
                {/* 背景样式：使用真实 GraphBackground 渲染缩略预览。 */}
                <fieldset>
                    <legend className="sr-only">背景样式</legend>
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">背景样式</span>
                        <button
                            className="inline-flex min-h-5 items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-muted hover:text-signal disabled:hover:text-muted"
                            type="button"
                            disabled={isDefault}
                            onClick={() => onChange(createDefaultGraphBackground())}
                            title="恢复节点图背景默认设置"
                        >
                            <RotateCcw size={12} />
                            恢复默认
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {styleOptions.map((option) => (
                            <StyleOptionControl
                                key={option.value}
                                option={option}
                                groupName={`${groupId}-style`}
                                selected={preferences.style === option.value}
                                preferences={preferences}
                                onSelect={() => onChange({ ...preferences, style: option.value })}
                            />
                        ))}
                    </div>
                </fieldset>

                {/* 纯色没有纹理参数，因此只在非纯色时展示后续控制项。 */}
                {pattern && (
                    <>
                        {preferences.style === 'dots' && (
                            <RangeControl
                                label="圆点大小"
                                value={preferences.dots.size}
                                min={1}
                                max={3}
                                step={0.5}
                                onChange={(size) => onChange({
                                    ...preferences,
                                    dots: { ...preferences.dots, size },
                                })}
                            />
                        )}
                        {preferences.style === 'crosses' && (
                            <RangeControl
                                label="十字大小"
                                value={preferences.crosses.size}
                                min={4}
                                max={8}
                                onChange={(size) => onChange({
                                    ...preferences,
                                    crosses: { ...preferences.crosses, size },
                                })}
                            />
                        )}
                        {preferences.style === 'grid' && (
                            <RangeControl
                                label="线条粗细"
                                value={preferences.grid.lineWidth}
                                min={0.5}
                                max={1.5}
                                step={0.5}
                                onChange={(lineWidth) => onChange({
                                    ...preferences,
                                    grid: { ...preferences.grid, lineWidth },
                                })}
                            />
                        )}
                        {preferences.style === 'crosses' && (
                            <RangeControl
                                label="线条粗细"
                                value={preferences.crosses.lineWidth}
                                min={0.5}
                                max={1.5}
                                step={0.5}
                                onChange={(lineWidth) => onChange({
                                    ...preferences,
                                    crosses: { ...preferences.crosses, lineWidth },
                                })}
                            />
                        )}
                        <RangeControl
                            label="纹理间距"
                            value={pattern.spacing}
                            min={16}
                            max={40}
                            onChange={(spacing) => updatePattern({ spacing })}
                        />

                        {/* 纹理深浅只影响当前选中的样式。 */}
                        <fieldset>
                            <legend className="mb-3 text-sm font-medium">纹理深浅</legend>
                            <div className="grid grid-cols-3 gap-2">
                                {intensityOptions.map((option) => (
                                    <IntensityOptionControl
                                        key={option.value}
                                        option={option}
                                        groupName={`${groupId}-intensity`}
                                        selected={pattern.intensity === option.value}
                                        onSelect={() => updatePattern({ intensity: option.value })}
                                    />
                                ))}
                            </div>
                        </fieldset>
                    </>
                )}
            </div>

            {/* 右侧使用与真实行动图相同的背景组件和预览组件。 */}
            <GraphAppearancePreview
                preferences={preferences}
                showLegend={showLegend}
                onShowLegendChange={onShowLegendChange}
            />
        </div>
    )
}

/** 单个背景样式卡片，点击后切换当前背景。 */
function StyleOptionControl({
                                option,
                                groupName,
                                selected,
                                preferences,
                                onSelect,
                            }: {
    option: StyleOption
    groupName: string
    selected: boolean
    preferences: GraphBackgroundPreferences
    onSelect: () => void
}) {
    return (
        <label className="min-w-0 cursor-pointer">
            <input
                className="peer sr-only"
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                onChange={onSelect}
            />
            <span className="block overflow-hidden rounded-md border border-line bg-surface transition hover:border-signal/50 peer-checked:border-signal peer-checked:ring-1 peer-checked:ring-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal">
                <span className="relative block h-14">
                    <GraphBackground preferences={{ ...preferences, style: option.value }} />
                </span>
            </span>
            <span className={`mt-2 block text-center text-xs ${selected ? 'font-semibold text-signal' : 'text-muted'}`}>
                {option.label}
            </span>
        </label>
    )
}

/** 纹理深浅的单选项。 */
function IntensityOptionControl({
                                    option,
                                    groupName,
                                    selected,
                                    onSelect,
                                }: {
    option: IntensityOption
    groupName: string
    selected: boolean
    onSelect: () => void
}) {
    return (
        <label className="min-w-0 cursor-pointer">
            <input
                className="peer sr-only"
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                onChange={onSelect}
            />
            <span className="flex h-9 items-center justify-center rounded-md border border-line text-sm text-muted hover:border-signal/50 peer-checked:border-signal peer-checked:bg-signal-soft peer-checked:font-medium peer-checked:text-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal">
                {option.label}
            </span>
        </label>
    )
}

/** 带标签和当前值的数字滑块。 */
function RangeControl({
                          label,
                          value,
                          min,
                          max,
                          step = 1,
                          onChange,
                      }: {
    label: string
    value: number
    min: number
    max: number
    step?: number
    onChange: (value: number) => void
}) {
    const inputId = useId()

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <label className="font-medium" htmlFor={inputId}>{label}</label>
                <output className="text-xs tabular-nums text-muted" htmlFor={inputId}>{value} px</output>
            </div>
            <input
                className="block h-5 w-full cursor-pointer accent-signal"
                id={inputId}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}
