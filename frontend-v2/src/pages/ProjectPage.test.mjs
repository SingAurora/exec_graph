import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDefaultGraphBackground } from '../shared/ui/graph-background/model.ts'
import { ToastContext } from '../shared/ui/toast/ToastContext.ts'
import { TooltipProvider } from '../shared/ui/tooltip/Tooltip.tsx'
import { ProjectPage } from './ProjectPage.tsx'

const noop = () => {}
const project = { id: 'empty-graph', ownerId: 'jo', participantIds: [], title: '厨艺练习', description: '', createdAt: '2026-10-18T12:00:00+08:00' }
const render = (actions, props = {}) => renderToStaticMarkup(createElement(TooltipProvider, null, createElement(ToastContext.Provider, { value: { showToast: noop } }, createElement(ProjectPage, {
  project, currentUserId: 'jo', users: [], actions, showActionGraphLegend: false,
  graphBackground: createDefaultGraphBackground(), onCreateAction: noop,
  onContinueAction: noop, onOpenActionArchive: noop, onUpdateProject: noop,
  onEditExpression: () => true, onUpdateAgreement: () => true, onDeleteProject: () => true, ...props,
}))))

describe('first action entry', () => {
  test('an empty graph has one creation entry inside its header and disables search', () => {
    const html = render([])
    expect(html.match(/记录第一次行动/g)).toHaveLength(1)
    expect(html.match(/<header[^>]*aria-label="图名片"[\s\S]*?<\/header>/)?.[0]).toContain('记录第一次行动')
    expect(html.match(/<button[^>]*id="[^"]*-trigger-search"[^>]*>/)?.[0]).toMatch(/ disabled(?:=|\s|>)/)
    expect(html).toContain('暂无表达')
    expect(html).toContain('暂无行动')
  })

  test('publishing a node removes the first action entry and enables search', () => {
    const html = render([{
      id: 'action-1', projectId: project.id, number: 1, authorId: 'jo', title: '做了一盘炒蛋',
      markdown: '鸡蛋边缘偏硬', expressionMarkdown: '', images: [], conversation: [], createdAt: project.createdAt,
    }])
    expect(html).not.toContain('记录第一次行动')
    expect(html.match(/<button[^>]*id="[^"]*-trigger-search"[^>]*>/)?.[0]).not.toMatch(/ disabled(?:=|\s|>)/)
  })
})

describe('graph deletion entry', () => {
  test('the creator can delete an empty graph from settings', () => {
    const html = render([])
    expect(html).toContain('删除图')
    expect(html).toContain('图标题')
  })

  test('a participant sees disabled deletion with a reason without inheriting editing permission', () => {
    const html = render([], { project: { ...project, ownerId: 'lin', participantIds: ['jo'] } })
    expect(html).toContain('删除图')
    expect(html).toContain('trigger-settings')
    expect(html).not.toContain('图标题')
    expect(html).not.toContain('>保存</button>')
    expect(html).toContain('已有其他用户参与，不能删除此图')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?删除图<\/button>/)
  })

  test('a creator also sees disabled deletion when another user has joined', () => {
    const html = render([], { project: { ...project, participantIds: ['lin'] } })
    expect(html).toContain('删除图：已有其他用户参与，不能删除此图')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?删除图<\/button>/)
  })

  test('an uninvolved visitor has no deletion control or settings tab', () => {
    const html = render([], { currentUserId: 'visitor' })
    expect(html).not.toContain('删除图')
    expect(html).not.toContain('trigger-settings')
  })
})
