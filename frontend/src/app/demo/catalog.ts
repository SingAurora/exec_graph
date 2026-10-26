import type { Project } from '../../entities/project/model/types'
import type { UserProfile } from '../../entities/profile/model/types'
import { cookingContextGuide } from './cooking'
import { cookingParticipants } from './cooking/participants'
import { interestHighlightNodeIds, interestProjects } from './interests'
import cookingGraphAvatar from '../../../assets/cooking-graph-avatar.jpg'
import cookingGraphBackground from '../../../assets/cooking-graph-background.jpg'

const currentUserBiography = [
  '从 92kg 开始减肥，带相机在厦门到处走，也试着从厦门骑到漳州。',
  '',
  '最近想继续开《伯明翰》，也在慢慢探索《马里奥奥德赛》。想找能一起出发、开桌，或者交换经历的人。',
].join('\n')

export const currentUser: UserProfile = { id: 'jo', name: '乔', email: 'qiao@example.com', gender: 'unknown', bio: currentUserBiography, avatar: '', activeDays: 12, isTestAccount: true, highlights: { expressionNodeIds: interestHighlightNodeIds } }
export const lin: UserProfile = { id: 'lin', name: '林岚', email: 'lin@example.com', gender: 'female', bio: '把手上的事情认真做完。', avatar: '', activeDays: 28 }
export const miao: UserProfile = { id: 'miao', name: 'miao', email: 'miao@example.com', gender: 'unknown', bio: '从生活里找到下一步。', avatar: '', activeDays: 9 }

export const initialProjects: Project[] = [
  ...interestProjects,
  { id: 'cooking', ownerId: 'jo', participantIds: ['lin', 'miao', ...cookingParticipants.map((user) => user.id)], title: '一盘番茄炒蛋：练出可复现的好吃', description: '从番茄和鸡蛋出发，各自在真实晚餐里练习、复做和借用彼此的经验，留下做法的变化与不同的口味取舍。', avatar: cookingGraphAvatar, backgroundImage: cookingGraphBackground, contextGuide: cookingContextGuide, createdAt: '2026-10-03T19:30:00+08:00', updatedAt: '2026-10-21T19:20:00+08:00' },
  { id: 'daily', ownerId: 'jo', participantIds: ['lin', 'miao'], title: '日常空间整理', description: '让每天使用的空间更容易进入和维持。', createdAt: '2026-09-28T10:00:00+08:00', updatedAt: '2026-10-11T10:20:00+08:00' },
  { id: 'learning', ownerId: 'jo', participantIds: [], title: '阅读与思考', description: '把阅读变成可以回看的理解和行动。', createdAt: '2026-10-01T19:30:00+08:00', updatedAt: '2026-10-11T09:10:00+08:00' },
  { id: 'practice', ownerId: 'lin', participantIds: [], title: '生活技能练习', description: '通过一次次实际完成积累生活经验。', createdAt: '2025-09-20T08:00:00+08:00', updatedAt: '2025-10-11T08:10:00+08:00' },
]
