import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDefaultGraphBackground } from '../../shared/ui/graph-background/model.ts'
import { AppearanceSettingsView } from './AppearanceSettings.tsx'

const render = (overrides = {}) => renderToStaticMarkup(createElement(AppearanceSettingsView, {
  theme: 'light',
  onThemeChange() {},
  graphBackground: createDefaultGraphBackground(),
  onGraphBackgroundChange() {},
  showActionGraphLegend: false,
  onShowActionGraphLegendChange() {},
  ...overrides,
}))

describe('appearance preferences', () => {
  test('marks the actual theme, including changes made outside the settings page', () => {
    for (const theme of ['light', 'dark']) {
      const html = render({ theme })
      expect(html).toMatch(new RegExp(`<button[^>]*data-state="checked"[^>]*value="${theme}"`))
      expect(html.match(/<button[^>]*data-state="checked"[^>]*value="(?:light|dark)"/g)).toHaveLength(1)
    }
  })

  test('shows only relevant controls without losing the preview or legend switch for plain backgrounds', () => {
    for (const style of ['plain', 'dots', 'grid', 'crosses']) {
      const html = render({ graphBackground: { ...createDefaultGraphBackground(), style } })
      expect(html).toContain('>实时预览</figcaption>')
      expect(html).toMatch(/<label[^>]*for="[^"]+">显示图例<\/label>/)
      expect(html.includes('圆点大小')).toBe(style === 'dots')
      expect(html.includes('十字大小')).toBe(style === 'crosses')
      expect(html.includes('线条粗细')).toBe(style === 'grid' || style === 'crosses')
      expect(html.includes('纹理间距')).toBe(style !== 'plain')
    }
  })

  test('the preview shows the shared four-part legend only when enabled', () => {
    expect(render()).not.toContain('行动接续')
    const html = render({ showActionGraphLegend: true })
    for (const label of ['行动接续', '引用其他', '满足约定', '节点层级']) expect(html).toContain(label)
    expect(html).toContain('data-state="checked"')
  })

  test('reset is enabled for changed settings, including retained settings of an inactive background', () => {
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*title="恢复节点图背景默认设置"/)
    const changed = createDefaultGraphBackground()
    changed.grid.spacing = 32
    const reset = render({ graphBackground: changed }).match(/<button[^>]*title="恢复节点图背景默认设置"[^>]*>/)?.[0]
    expect(reset).toBeDefined()
    expect(reset).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })
})
