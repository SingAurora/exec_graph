import type { UserProfile } from '../../../entities/profile/model/types'

/** Additional cooks with published actions, including enough profiles to preview participant overflow. */
export const cookingParticipants: UserProfile[] = [
  { uuid: 'che', name: '阿澈', email: 'che@example.com', gender: 'unknown', bio: '从一人食开始练习。', avatar: '', activeDays: 4 },
  { uuid: 'xiaoman', name: '小满', email: 'xiaoman@example.com', gender: 'unknown', bio: '慢慢找到自己喜欢的口感。', avatar: '', activeDays: 6 },
  { uuid: 'chenhe', name: '陈禾', email: 'chenhe@example.com', gender: 'unknown', bio: '把每顿饭做过的步骤记下来。', avatar: '', activeDays: 3 },
  { uuid: 'robin', name: 'Robin', email: 'robin@example.com', gender: 'unknown', bio: '换一种做法，也留下没做好的地方。', avatar: '', activeDays: 5 },
]
