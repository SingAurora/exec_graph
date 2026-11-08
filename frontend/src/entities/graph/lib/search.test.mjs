import { describe, expect, test } from 'bun:test'
import { searchGraphs } from './search.ts'

const graphs = [
  { uuid: 'cooking', id: 'cooking', title: '番茄炒蛋', description: '下班后试试三分钟快手菜', backgroundImage: '/image-only.jpg' },
  { uuid: 'games', id: 'games', title: 'Game [A]', description: '记录每次游戏的体验' },
]

describe('profile graph search', () => {
  test('matches names and introductions literally, ignoring case and surrounding spaces', () => {
    expect(searchGraphs(graphs, '番茄')).toEqual([graphs[0]])
    expect(searchGraphs(graphs, '三分钟')).toEqual([graphs[0]])
    expect(searchGraphs(graphs, ' game [a] ')).toEqual([graphs[1]])
    expect(searchGraphs(graphs, 'image-only')).toEqual([])
    expect(searchGraphs(graphs, '不存在')).toEqual([])
  })

  test('only searches supplied profile graphs and retains their original order', () => {
    expect(searchGraphs([graphs[0]], 'Game')).toEqual([])
    expect(searchGraphs(graphs, ' ')).toBe(graphs)
    expect(searchGraphs(graphs, '')).toBe(graphs)
    expect(searchGraphs([], '番茄')).toEqual([])
  })
})
