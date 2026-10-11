export function guessTitle(text: string) {
  const cleanText = text.trim().replace(/[。！？!?.]+$/u, '')
  if (cleanText.length <= 14) return cleanText.replace(/^(我想|我要|准备|打算)/u, '') || '一件小事'
  return `${cleanText.slice(0, 14)}…`
}

export function inferFocusPoints(text: string) {
  const cleanText = text.toLowerCase()
  if (cleanText.includes('洗澡') || cleanText.includes('洗个澡')) {
    return ['头发和身体重点部位洗到', '洗完把身体擦干', '洗护用品放回原位']
  }
  if (cleanText.includes('房间') || cleanText.includes('整理')) {
    return ['先清出最影响使用的区域', '把留下的东西放回固定位置', '完成后留一点可持续的秩序']
  }
  if (cleanText.includes('读') || cleanText.includes('书')) {
    return ['完成约定的阅读范围', '记下一条真正属于自己的理解', '读不下去时记录卡住的地方']
  }
  if (cleanText.includes('运动') || cleanText.includes('跑') || cleanText.includes('锻炼')) {
    return ['先完成一个可以开始的时长', '注意身体的关键反馈', '结束后做简单收尾']
  }
  return ['先完成这件事最核心的部分', '留意一个影响质量的关键点', '做完后记下实际发生了什么']
}
