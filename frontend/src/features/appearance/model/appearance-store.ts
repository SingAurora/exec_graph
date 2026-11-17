import { create } from 'zustand'
import {
    createDefaultGraphBackground,
    normalizeGraphBackground,
    type GraphBackgroundPreferences,
} from '../../../shared/ui/graph-background/model'

const themeKey = 'exact.appearance.theme'
const graphBackgroundKey = 'exact.actionGraph.background.v1'
const legendKey = 'execg.actionGraph.showLegend'

type AppearanceState = {
    /** 当前主题，仅影响本机界面。 */
    darkMode: boolean
    /** 行动节点图的背景样式和纹理参数。 */
    graphBackground: GraphBackgroundPreferences
    /** 是否在行动图上显示四部分图例。 */
    showActionGraphLegend: boolean
    /** 切换明暗主题并写入本机存储。 */
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

function readDarkMode(): boolean {
    return readStorage(themeKey) === 'dark'
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
function applyTheme(darkMode: boolean): void {
    if (typeof document === 'undefined') return

    if (darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark')
    } else {
        document.documentElement.removeAttribute('data-theme')
    }
}

const initialDarkMode = readDarkMode()
applyTheme(initialDarkMode)

/** 全局外观偏好：只保存本机 UI 设置，不混入账户资料或 Query 缓存。 */
export const useAppearanceStore = create<AppearanceState>((set) => ({
    darkMode: initialDarkMode,
    graphBackground: readGraphBackground(),
    showActionGraphLegend: readLegend(),

    toggleTheme: () => set((state) => {
        const darkMode = !state.darkMode
        applyTheme(darkMode)
        writeStorage(themeKey, darkMode ? 'dark' : 'light')
        return { darkMode }
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
