import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDefaultGraphBackground } from '../../shared/ui/graph-background/model.ts'
import { AppearanceSettings } from './AppearanceSettings.tsx'

const render = (overrides = {}) => renderToStaticMarkup(createElement(AppearanceSettings, {
  darkMode: false, onToggleTheme() {}, graphBackground: createDefaultGraphBackground(),
  onGraphBackgroundChange() {}, showActionGraphLegend: false, onShowActionGraphLegendChange() {}, ...overrides,
}))

describe('appearance preferences', () => {
  test('marks the actual theme, including changes made outside the settings page', () => {
    for (const darkMode of [false, true]) {
      const html = render({ darkMode })
      const theme = darkMode ? 'dark' : 'light'
      expect(html).toMatch(new RegExp(`role="radio"[^>]*aria-checked="true"[^>]*value="${theme}"`))
      expect(html.match(/role="radio"[^>]*aria-checked="true"/g)).toHaveLength(1)
    }
  })

  test('shows only relevant controls without losing the preview or legend switch for plain backgrounds', () => {
    for (const style of ['plain', 'dots', 'grid', 'crosses']) {
      const html = render({ graphBackground: { ...createDefaultGraphBackground(), style } })
      expect(html).toContain('aria-label="节点图外观预览"')
      expect(html).toContain('role="switch"')
      expect(html.includes('圆点大小')).toBe(style === 'dots')
      expect(html.includes('十字大小')).toBe(style === 'crosses')
      expect(html.includes('线条粗细')).toBe(style === 'grid' || style === 'crosses')
      expect(html.includes('纹理间距')).toBe(style !== 'plain')
    }
  })

  test('the preview shows the shared four-part legend only when enabled', () => {
    expect(render()).not.toContain('aria-label="节点关系图例"')
    const html = render({ showActionGraphLegend: true })
    expect(html).toContain('aria-label="节点关系图例"')
    for (const label of ['自己引用', '引用他人', '不满足约定', '节点层级']) expect(html).toContain(label)
    expect(html).toContain('aria-checked="true" data-state="checked"')
  })

  test('reset is enabled for changed settings, including retained settings of an inactive background', () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*aria-label="恢复节点图背景默认设置"/)
    const changed = createDefaultGraphBackground()
    changed.grid.spacing = 32
    expect(render({ graphBackground: changed })).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="恢复节点图背景默认设置"/)
  })
})
