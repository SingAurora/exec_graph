import type { DraftReview } from '@/entities/execution-node/model/types'

export type CompiledDraft = {
  title: string
  verifiableGoal: string
  acceptanceCriteria: string[]
  evidenceRequirement: string
}

const sectionLabels = {
  title: /^(?:契约标题|任务标题|标题)\s*(?:[:：]\s*(.*))?$/,
  goal: /^(?:(?:可验证)?目标|任务说明)\s*(?:[:：]\s*(.*))?$/,
  criteria: /^(?:验收标准|验收要求|完成标准)\s*(?:[:：]\s*(.*))?$/,
  evidence: /^(?:证据要求|证明要求|证据)\s*(?:[:：]\s*(.*))?$/,
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

export const buildDraftReview = (draft: string): { review: DraftReview; compiled: CompiledDraft } => {
  const compiled = compileDraft(draft)
  const missingRequirements: string[] = []

  if (compiled.title.length < 4) missingRequirements.push('需要使用“契约标题：”给出一个明确的标题。')
  if (compiled.verifiableGoal.length < 16) missingRequirements.push('需要使用“可验证目标：”写出可以判断是否达成的结果。')
  if (compiled.acceptanceCriteria.length < 2) {
    missingRequirements.push('需要在“验收标准：”下至少列出两条独立、可审查的标准。')
  }
  if (compiled.acceptanceCriteria.some((criterion) => criterion.length < 10)) {
    missingRequirements.push('每条验收标准需要具体到可以判定，而不是只写“完成”或“做好”。')
  }
  if (compiled.evidenceRequirement.length < 16) {
    missingRequirements.push('需要使用“证据要求：”说明提交什么结果可以支撑验收。')
  }

  const verdict = missingRequirements.length === 0 ? 'pass' : 'fail'
  return {
    compiled,
    review: {
      id: `draft-review-${crypto.randomUUID()}`,
      verdict,
      summary:
        verdict === 'pass'
          ? '节点草案审核通过。这个行动将遵循项目规则，并冻结目标、验收标准和证据要求。'
          : '节点草案审核未通过。此草案尚不能成为项目中的推进节点，请按平台规则补全后再提交。',
      missingRequirements,
      createdAt: new Date().toISOString(),
    },
  }
}
