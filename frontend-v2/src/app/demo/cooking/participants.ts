import type { UserProfile } from '../../../shared/model'

/** Additional cooks with published actions, including enough profiles to preview participant overflow. */
export const cookingParticipants: UserProfile[] = [
  { id: 'che', name: '阿澈', email: 'che@example.com', gender: 'unknown', bio: '从一人食开始练习。', avatar: '', activeDays: 4 },
  { id: 'xiaoman', name: '小满', email: 'xiaoman@example.com', gender: 'unknown', bio: '慢慢找到自己喜欢的口感。', avatar: '', activeDays: 6 },
  { id: 'chenhe', name: '陈禾', email: 'chenhe@example.com', gender: 'unknown', bio: '把每顿饭做过的步骤记下来。', avatar: '', activeDays: 3 },
  { id: 'robin', name: 'Robin', email: 'robin@example.com', gender: 'unknown', bio: '换一种做法，也留下没做好的地方。', avatar: '', activeDays: 5 },
]
