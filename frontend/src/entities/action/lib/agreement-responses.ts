import type { ActionReference } from './references'

/** 找到有效约定的实际提出者；传递约定的中间节点作者不自动成为提出者。 */
export function getReferenceAgreementAuthorUuid(reference: ActionReference): string {
  const origin = reference.agreement.sourceNode
  return origin?.agreementSupplement?.authorUuid ?? origin?.authorUuid ?? reference.source.authorUuid
}

/**
 * 约定内容流：筛选明确满足非空约定的跨用户引用，表达以行动回应对方的沟通意愿。
 * 自我引用、回应自己的原始约定、未核对和不满足的引用不进入此列表；每条箭头独立展示。
 */
export function getSatisfiedAgreementResponses(references: ActionReference[]): ActionReference[] {
  return references.filter((reference) => reference.agreementStatus === 'satisfied'
    && reference.agreement.markdown.trim()
    && !reference.sameAuthor
    && reference.target.authorUuid !== getReferenceAgreementAuthorUuid(reference))
    .sort((a, b) => Date.parse(b.target.createdAt) - Date.parse(a.target.createdAt)
      || b.target.number - a.target.number || a.uuid.localeCompare(b.uuid))
}

/** 个人约定记录同时包含“我回应别人”和“别人回应我”，一条引用只计一次。 */
export function getProfileAgreementResponses(references: ActionReference[], userUuid: string): ActionReference[] {
  return getSatisfiedAgreementResponses(references).filter((reference) => reference.target.authorUuid === userUuid
    || getReferenceAgreementAuthorUuid(reference) === userUuid)
}

/** 按一位或两位参与者筛选交流关系，双方顺序不限，保留原有排序。 */
export function filterAgreementParticipants(references: ActionReference[], participantUuid?: string, otherParticipantUuid?: string): ActionReference[] {
  if (!participantUuid && !otherParticipantUuid) return references
  if (participantUuid && participantUuid === otherParticipantUuid) return []
  return references.filter((reference) => {
    const participants = [reference.target.authorUuid, getReferenceAgreementAuthorUuid(reference)]
    return (!participantUuid || participants.includes(participantUuid))
      && (!otherParticipantUuid || participants.includes(otherParticipantUuid))
  })
}
