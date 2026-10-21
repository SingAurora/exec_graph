import type { ActionNode } from '../../entities/action/model/types'
import { cookingActions } from './cooking'

const everydayActions: ActionNode[] = [
  {
    id: 'daily-1', projectId: 'daily', number: 1, authorId: 'jo',
    title: '书桌只留下明天会用到的东西',
    markdown: '把桌上的包装盒、旧纸张和杯子移开，只留下电脑、笔记本和明天要读的书。\n\n最费时间的是给散落的充电线找位置。抽屉还没整理，但已经能坐下来直接开始工作。',
    expressionMarkdown: '先让空间重新能用起来，比一次整理完所有东西更重要。这次桌面可以直接开始工作，抽屉还可以以后处理。',
    images: [{ url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', alt: '书桌空间 · 配图' }],
    conversation: [
      { id: 'daily-1-user', speaker: 'user', body: '清掉了桌上的包装盒、旧纸张和杯子，留下电脑、笔记本和明天要读的书。充电线重新找了位置，抽屉没动，但桌面已经能用了。我觉得先能用比一次收完更重要。' },
      { id: 'daily-1-ai', speaker: 'ai', body: '行动中保留桌面已恢复使用、抽屉未整理的事实；表达中保留你对先恢复使用的取舍。' },
    ],
    createdAt: '2026-10-11T08:30:00+08:00',
  },
  {
    id: 'daily-2', projectId: 'daily', number: 2, parentId: 'daily-1', authorId: 'lin',
    title: '阳台终于有一块可以坐下来的地方',
    markdown: '没有一口气收完所有旧物，只把挡住椅子和门的箱子移到了墙边，擦了椅子。\n\n晚上真的在这里坐了十分钟。东西还在，但是空间已经重新用起来了。',
    images: [],
    conversation: [
      { id: 'daily-2-user', speaker: 'user', body: '参考乔先恢复使用的思路，今天挪开了阳台挡门和椅子的箱子、擦了椅子。晚上坐了十分钟，其他旧物还没整理。表达保留之前那份就好。' },
      { id: 'daily-2-ai', speaker: 'ai', body: '已整理本次阳台的实际变化，表达沿用来源节点，不把尚未整理的旧物写成已经完成。' },
    ],
    createdAt: '2026-10-11T18:20:00+08:00',
  },
  {
    id: 'daily-3', projectId: 'daily', number: 3, parentId: 'daily-1', authorId: 'miao',
    title: '先清出走到椅子的通道',
    markdown: '从门口开始，只挪动挡路的物品。最后留出了一条通往椅子的路，其他东西暂时原样放着。\n\n这次只花了十五分钟，进出时已经不用侧身。',
    expressionMarkdown: '从书桌到通道，我借用的是先恢复使用的思路。这次我更愿意保留一个具体标准：每天走的那条路，不需要再侧身。整理不一定先从收纳开始。',
    images: [],
    conversation: [
      { id: 'daily-3-user', speaker: 'user', body: '沿着乔的书桌记录，我也只处理影响使用的部分。今天花十五分钟挪开通往椅子的东西，进出不用侧身，其他地方没动。对我来说，先走得通比先收纳好更有用。' },
      { id: 'daily-3-ai', speaker: 'ai', body: '行动保留十五分钟清出通道的事实；表达在原先恢复使用的判断上，加入你对通道和收纳顺序的取舍。' },
    ],
    createdAt: '2026-10-11T20:05:00+08:00',
  },
  {
    id: 'practice-1', projectId: 'practice', number: 1, authorId: 'lin',
    title: '第一次烤酸面包，里面有些湿黏',
    markdown: '从喂养酵头、发酵到烤完出炉，记下了这两天的过程。\n\n表皮比想象中脆，切开后里面有些湿黏。我太心急，出炉不到二十分钟就切了，现在还不能确定是不是没烤透。',
    expressionMarkdown: '完整做过一遍，才看见自己在哪些地方太心急。湿黏的原因还不确定，先把这一次留下来，比急着给自己贴上失败的标签更有用。',
    images: [{ url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=80', alt: '酸面包 · 配图' }],
    conversation: [
      { id: 'practice-1-user', speaker: 'user', body: '两天里第一次走完喂酵头、发酵、烤面包的过程。外皮脆，里面湿黏，我出炉不到二十分钟就切了，不能确定是不是没烤透。我想先记录真实结果，不急着判定失败。' },
      { id: 'practice-1-ai', speaker: 'ai', body: '行动分别记录过程、切开时间和湿黏的观察，不推断原因；表达保留先完整尝试、暂缓判断的看法。' },
    ],
    createdAt: '2025-10-11T08:10:00+08:00',
  },
]

/** Published prototype records share one action model across every reading surface. */
export const demoActions: ActionNode[] = cookingActions.concat(everydayActions.map((node) => ({ ...node, objectiveMarkdown: node.markdown })))
