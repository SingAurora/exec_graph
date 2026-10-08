import type { DraftReview } from '@/entities/execution-node/model/types'
import { quickActionSmartContractUuid } from '@/entities/smart-contract/model/constants'

export type CompiledDraft = {
  title: string
  verifiableGoal: string
  acceptanceCriteria: string[]
  evidenceRequirement: string
}

const sectionLabels = {
  title: /^(?:契约标题|任务标题|标题)\s*(?:[:：]\s*(.*))?$/,
  goal: /^(?:(?:可验证)?目标|任务说明)\s*(?:[:：]\s*(.*))?$/,
  criteria: /^(?:做到位清单|验收标准|验收要求|完成标准)\s*(?:[:：]\s*(.*))?$/,
  evidence: /^(?:记录要求|证据要求|证明要求|证据)\s*(?:[:：]\s*(.*))?$/,
} as const

const stripListMarker = (line: string) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim()

export const compileDraft = (draft: string): CompiledDraft => {
  const sections: Record<keyof typeof sectionLabels, string[]> = {
    title: [],
    goal: [],
    criteria: [],
    evidence: [],
  }
  let activeSection: keyof typeof sectionLabels | null = null

  for (const rawLine of draft.split('\n')) {
    const line = rawLine.replace(/^\s*#{1,6}\s*/, '').trim()
    if (!line) continue

    const matchingSection = (Object.keys(sectionLabels) as Array<keyof typeof sectionLabels>).find((key) => sectionLabels[key].test(line))
    if (matchingSection) {
      const match = line.match(sectionLabels[matchingSection])
      activeSection = matchingSection
      if (match?.[1]?.trim()) sections[matchingSection].push(stripListMarker(match[1]))
      continue
    }

    if (activeSection) sections[activeSection].push(stripListMarker(line))
  }

  const firstMeaningfulLine = draft
    .split('\n')
    .map(stripListMarker)
    .find((line) => line && !Object.values(sectionLabels).some((pattern) => pattern.test(line))) ?? ''

  return {
    title: (sections.title[0] ?? firstMeaningfulLine).trim(),
    verifiableGoal: sections.goal.join(' ').trim(),
    acceptanceCriteria: sections.criteria.map((criterion) => criterion.trim()).filter((criterion) => criterion.length > 0),
    evidenceRequirement: sections.evidence.join(' ').trim(),
  }
}

export const buildDraftReview = (draft: string, smartContractUuid?: string): { review: DraftReview; compiled: CompiledDraft } => {
  const compiled = compileDraft(draft)
  const quickAction = smartContractUuid === quickActionSmartContractUuid
  const missingRequirements: string[] = []

  const titleMinimum = quickAction ? 1 : 4
  const goalMinimum = quickAction ? 1 : 16
  if (compiled.title.length < titleMinimum) missingRequirements.push('需要使用“标题：”给出一个明确的行动标题。')
  if (compiled.verifiableGoal.length < goalMinimum) missingRequirements.push('需要使用“目标：”写出希望推进和改变的事情。')
  if (compiled.acceptanceCriteria.length < (quickAction ? 1 : 2)) {
    missingRequirements.push(`需要在“做到位清单：”下至少列出${quickAction ? '一条' : '两条'}独立、可观察的关注点。`)
  }
  if (compiled.acceptanceCriteria.some((criterion) => criterion.length < (quickAction ? 2 : 10))) {
    missingRequirements.push('每条做到位清单需要具体到可以记录和观察，而不是只写“完成”或“做好”。')
  }
  if (!quickAction && compiled.evidenceRequirement.length < 16) {
    missingRequirements.push('需要使用“记录要求：”说明要记录哪些行动、变化或仍未知的部分。')
  }

  if (quickAction && compiled.evidenceRequirement.length === 0) {
    compiled.evidenceRequirement = '记录实际做了什么、最重要的变化，以及仍需观察的地方。'
  }

  const verdict = missingRequirements.length === 0 ? 'pass' : 'fail'
  return {
    compiled,
    review: {
      uuid: crypto.randomUUID(),
      verdict,
      summary:
        verdict === 'pass'
          ? '行动草案已经足够清楚，可以保存为一次推进。'
          : '行动草案仍需补充，先把目标、做到位清单或记录要求说清楚。',
      missingRequirements,
      createdAt: new Date().toISOString(),
    },
  }
}
