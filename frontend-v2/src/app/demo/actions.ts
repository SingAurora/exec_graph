import type { ActionNode } from '../../entities/action/model/types'
import { cookingActions } from './cooking'

export const demoActions: ActionNode[] = cookingActions.concat([
  { id: 'daily-1', projectId: 'daily', number: 1, authorId: 'jo', title: '书桌只留下明天会用到的东西', markdown: '把桌上的包装盒、旧纸张和杯子移开，只留下电脑、笔记本和明天要读的书。\n\n最费时间的是给散落的充电线找位置。抽屉还没整理，但已经能坐下来直接开始工作。', images: [{ url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', alt: '书桌空间 · 配图' }], conversation: [], createdAt: '2026-10-11T08:30:00+08:00', parentId: undefined },
  { id: 'daily-2', projectId: 'daily', number: 2, parentId: 'daily-1', authorId: 'lin', title: '阳台终于有一块可以坐下来的地方', markdown: '没有一口气收完所有旧物，只把挡住椅子和门的箱子移到了墙边，擦了椅子。\n\n晚上真的在这里坐了十分钟。东西还在，但是空间已经重新用起来了。', images: [], conversation: [], createdAt: '2026-10-11T18:20:00+08:00' },
  { id: 'daily-3', projectId: 'daily', number: 3, parentId: 'daily-1', authorId: 'miao', title: '先清出走到椅子的通道', markdown: '从门口开始，只挪动挡路的物品。最后留出了一条通往椅子的路，其他东西暂时原样放着。\n\n这次只花了十五分钟，进出时已经不用侧身。', images: [], conversation: [], createdAt: '2026-10-11T20:05:00+08:00' },
  { id: 'practice-1', projectId: 'practice', number: 1, authorId: 'lin', title: '第一次烤酸面包，里面有些湿黏', markdown: '从喂养酵头、发酵到烤完出炉，记下了这两天的过程。\n\n表皮比想象中脆，切开后里面有些湿黏。我太心急，出炉不到二十分钟就切了，现在还不能确定是不是没烤透。', images: [{ url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80', alt: '酸面包 · 配图' }], conversation: [], createdAt: '2026-10-11T08:10:00+08:00', parentId: undefined },
])
