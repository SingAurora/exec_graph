import { describe, expect, test } from 'bun:test'
import { searchProjects } from './search.ts'

const graphs = [
  { id: 'cooking', title: '番茄炒蛋', description: '下班后试试三分钟快手菜', backgroundImage: '/image-only.jpg' },
  { id: 'games', title: 'Game [A]', description: '记录每次游戏的体验' },
]

describe('profile graph search', () => {
  test('matches names and introductions literally, ignoring case and surrounding spaces', () => {
    expect(searchProjects(graphs, '番茄')).toEqual([graphs[0]])
    expect(searchProjects(graphs, '三分钟')).toEqual([graphs[0]])
    expect(searchProjects(graphs, ' game [a] ')).toEqual([graphs[1]])
    expect(searchProjects(graphs, 'image-only')).toEqual([])
    expect(searchProjects(graphs, '不存在')).toEqual([])
  })

  test('only searches supplied profile graphs and retains their original order', () => {
    expect(searchProjects([graphs[0]], 'Game')).toEqual([])
    expect(searchProjects(graphs, ' ')).toBe(graphs)
    expect(searchProjects(graphs, '')).toBe(graphs)
    expect(searchProjects([], '番茄')).toEqual([])
  })
})
