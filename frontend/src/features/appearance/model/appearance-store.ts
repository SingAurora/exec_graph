import { create } from 'zustand'
import {
    createDefaultGraphBackground,
    normalizeGraphBackground,
    type GraphBackgroundPreferences,
} from '../../../shared/ui/graph-background/model'

const themeKey = 'exact.appearance.theme'
const graphBackgroundKey = 'exact.actionGraph.background.v1'
const legendKey = 'execg.actionGraph.showLegend'

export type Theme = 'light' | 'dark'

type AppearanceState = {
    /** 当前主题，仅影响本机界面。 */
    theme: Theme
    /** 行动节点图的背景样式和纹理参数。 */
    graphBackground: GraphBackgroundPreferences
    /** 是否在行动图上显示四部分图例。 */
    showActionGraphLegend: boolean
    /** 设置指定主题并写入本机存储。 */
    setTheme: (theme: Theme) => void
    /** 在明暗主题之间切换，供侧栏快捷按钮使用。 */
    toggleTheme: () => void
    /** 更新背景偏好并写入本机存储。 */
    setGraphBackground: (preferences: GraphBackgroundPreferences) => void
    /** 更新图例开关并写入本机存储。 */
    setShowActionGraphLegend: (show: boolean) => void
}

/** 读取本机存储；隐私模式或测试环境不可用时返回 null。 */
function readStorage(key: string): string | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorage(key: string, value: string): void {
    try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
    } catch {
        // 存储失败不影响当前会话里的外观设置。
    }
}

function readTheme(): Theme {
    return readStorage(themeKey) === 'dark' ? 'dark' : 'light'
}

function readGraphBackground(): GraphBackgroundPreferences {
    try {
        return normalizeGraphBackground(JSON.parse(readStorage(graphBackgroundKey) ?? 'null'))
    } catch {
        return createDefaultGraphBackground()
    }
}

function readLegend(): boolean {
    return readStorage(legendKey) === 'true'
}

/** 把主题应用到根节点；模块初始化时先应用一次，避免刷新时闪回浅色。 */
function applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') return

    document.documentElement.setAttribute('data-theme', theme)
}

const initialTheme = readTheme()
applyTheme(initialTheme)

/** 全局外观偏好：只保存本机 UI 设置，不混入账户资料或 Query 缓存。 */
export const useAppearanceStore = create<AppearanceState>((set) => ({
    theme: initialTheme,
    graphBackground: readGraphBackground(),
    showActionGraphLegend: readLegend(),

    setTheme: (theme) => {
        applyTheme(theme)
        writeStorage(themeKey, theme)
        set({ theme })
    },

    toggleTheme: () => set((state) => {
        const theme = state.theme === 'dark' ? 'light' : 'dark'
        applyTheme(theme)
        writeStorage(themeKey, theme)
        return { theme }
    }),

    setGraphBackground: (graphBackground) => {
        writeStorage(graphBackgroundKey, JSON.stringify(graphBackground))
        set({ graphBackground })
    },

    setShowActionGraphLegend: (showActionGraphLegend) => {
        writeStorage(legendKey, String(showActionGraphLegend))
        set({ showActionGraphLegend })
    },
}))
