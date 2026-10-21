export function guessTitle(text: string) {
  const cleanText = text.trim().replace(/[。！？!?.]+$/u, '').replace(/^(我想|我要|准备|打算)/u, '')
  const firstThought = cleanText.split(/[，,；;]/u)[0].trim()
  if (firstThought.length <= 18) return firstThought || '一件小事'
  return `${firstThought.slice(0, 18)}…`
}

export function inferFocusPoints(text: string) {
  const cleanText = text.toLowerCase()
  if (cleanText.includes('阳台')) return ['清理影响使用的杂物', '留出一块可以坐下来的位置', '记录还没有固定收纳的东西']
  if (cleanText.includes('房间') || cleanText.includes('整理')) return ['先清出最影响使用的区域', '把留下的东西放回固定位置', '做完后记录仍然没有解决的地方']
  if (cleanText.includes('洗澡') || cleanText.includes('洗个澡')) return ['头发和身体重点部位洗到', '洗完把身体擦干', '洗护用品放回原位']
  if (cleanText.includes('读') || cleanText.includes('书')) return ['完成约定的阅读范围', '记下一条真正属于自己的理解', '记录读不下去或卡住的地方']
  if (cleanText.includes('运动') || cleanText.includes('跑') || cleanText.includes('锻炼')) return ['先完成一个可以开始的时长', '留意身体的关键反馈', '结束后做简单收尾']
  return ['先完成这件事最核心的部分', '留意一个影响质量的关键点', '做完后记下实际发生了什么']
}

export function buildPlanMarkdown(title: string, description: string, points: string[]) {
  return `# ${title}\n\n## 目标\n\n${description}\n\n## 这次重点\n\n${points.map((point) => `- ${point}`).join('\n')}\n\n## 完成时可以观察什么\n\n- 这次约定的核心部分是否实际发生\n- 哪些地方还没有处理\n- 做完后留下了什么新的观察`
}

export function buildCompletionMarkdown(title: string, plan: PlanSnapshot, note: string) {
  const points = plan.points.map((point) => `- ${point}`).join('\n')
  return `# ${title}：完成记录\n\n## 原计划\n\n${plan.description}\n\n## 这次实际发生\n\n${note}\n\n## 原计划关注\n\n${points}\n\n## 这次留下的观察\n\n${note.includes('还') || note.includes('没有') ? '这次行动仍有未完全处理的部分，后续可以继续观察。' : '这次行动已经留下了一份可以继续回看的实际记录。'}`
}

export type PlanSnapshot = { description: string; points: string[] }
