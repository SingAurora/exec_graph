import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { actors, branches as seedBranches, completionRecords as seedCompletionRecords, contracts, currentActorId, defaultProjectId, edges, projects, smartContracts } from '../data/seed'
import type {
  AIReview,
  AcceptanceCriterion,
  Actor,
  CompletionRecord,
  ContractStage,
  DraftReview,
  ExecutionBranch,
  ExecutionContract,
  ExecutionEdge,
  ExecutionNodeKind,
  Gender,
  Project,
  ProjectContractRevision,
  ReviewVerdict,
  SmartContractDefinition,
  UserVerdict,
} from '../types'

type SubmitCompletionInput = {
  completionClaim: string
  evidenceText: string
}

type CreateContractInput = {
  projectId: string
  draft: string
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
}

type CreateProjectInput = {
  title: string
  description: string
  smartContractId: string
  visibility: 'private' | 'public'
}

type UpdateProjectInput = {
  title: string
  description: string
  visibility: 'private' | 'public'
}

type CreateSmartContractInput = {
  name: string
  description: string
  body: string
}

type CreateContractResult = {
  contractId?: string
  draftReview: DraftReview
}

type AuthResult = {
  success: boolean
  message?: string
}

type ProfileInput = {
  handle: string
  bio: string
  gender: Gender
  avatarUrl?: string
}

type CompiledDraft = {
  title: string
  verifiableGoal: string
  acceptanceCriteria: string[]
  evidenceRequirement: string
}

type ExecState = {
  actors: typeof actors
  currentActorId: string
  isAuthenticated: boolean
  accessToken: string
  accountEmail: string
  accountPassword: string
  projects: Project[]
  smartContracts: SmartContractDefinition[]
  branches: ExecutionBranch[]
  contracts: ExecutionContract[]
  completionRecords: CompletionRecord[]
  edges: ExecutionEdge[]
  createProject: (input: CreateProjectInput) => string | null
  updateProject: (projectId: string, input: UpdateProjectInput) => void
  createSmartContract: (input: CreateSmartContractInput) => string
  upgradeProjectContract: (projectId: string, smartContractId: string) => void
  archiveProject: (projectId: string) => void
  createContract: (input: CreateContractInput) => CreateContractResult
  submitCompletion: (contractId: string, input: SubmitCompletionInput) => void
  confirmCompletion: (contractId: string) => void
  createSupplementContract: (contractId: string) => void
  signIn: (email: string, password: string) => AuthResult
  registerAccount: (username: string, email: string, password: string) => AuthResult
  setAccessToken: (token: string) => void
  signOut: () => void
  updateProfile: (input: ProfileInput) => void
  updateAccountEmail: (email: string, currentPassword: string) => AuthResult
  updateAccountPassword: (currentPassword: string, nextPassword: string) => AuthResult
  resetDemo: () => void
}

type LegacyContract = Omit<Partial<ExecutionContract>, 'stage'> & {
  stage?: string
  goalId?: string
  skillId?: string
  skillVersion?: string
  excludedScope?: string
}

type LegacySmartContract = Partial<SmartContractDefinition> & {
  deploymentRules?: string[]
  reviewPrinciple?: string
}

type LegacyState = {
  nodes?: unknown[]
  actors?: Actor[]
  currentActorId?: string
  isAuthenticated?: boolean
  accessToken?: string
  accountEmail?: string
  accountPassword?: string
  smartContracts?: LegacySmartContract[]
  projects?: Project[]
  branches?: ExecutionBranch[]
  contracts?: LegacyContract[]
  completionRecords?: CompletionRecord[]
  edges?: ExecutionEdge[]
}

const now = () => new Date().toISOString()

const sectionLabels = {
  title: /^(?:契约标题|任务标题|标题)\s*(?:[:：]\s*(.*))?$/,
  goal: /^(?:(?:可验证)?目标|任务说明)\s*(?:[:：]\s*(.*))?$/,
  criteria: /^(?:验收标准|验收要求|完成标准)\s*(?:[:：]\s*(.*))?$/,
  evidence: /^(?:证据要求|证明要求|证据)\s*(?:[:：]\s*(.*))?$/,
} as const

const makeRuleHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const stripListMarker = (line: string) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, '').trim()

const compileDraft = (draft: string): CompiledDraft => {
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

    const matchingSection = (Object.keys(sectionLabels) as Array<keyof typeof sectionLabels>).find((key) =>
      sectionLabels[key].test(line),
    )
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
    .find((line) => line && !Object.values(sectionLabels).some((pattern) => pattern.test(line)))
    ?? ''

  return {
    title: (sections.title[0] ?? firstMeaningfulLine).trim(),
    verifiableGoal: sections.goal.join(' ').trim(),
    acceptanceCriteria: sections.criteria.map((criterion) => criterion.trim()).filter((criterion) => criterion.length > 0),
    evidenceRequirement: sections.evidence.join(' ').trim(),
  }
}

const buildDraftReview = (draft: string): { review: DraftReview; compiled: CompiledDraft } => {
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
          ? '部署校验通过。这项行为将继承项目当前智能合约版本，并冻结目标、验收标准和证据要求。'
          : '部署校验未通过。此草案尚不能成为项目中的行为承诺，请按平台规则补全后再提交。',
      missingRequirements,
      createdAt: now(),
    },
  }
}

const buildTaskDraftReview = (draft: string): { review: DraftReview; compiled: CompiledDraft } => {
  const compiled = compileDraft(draft)
  const lines = draft
    .split('\n')
    .map(stripListMarker)
    .filter(Boolean)
  const title = compiled.title || lines[0] || ''
  const taskBody = compiled.verifiableGoal || lines.slice(1).join(' ') || draft.trim()
  const missingRequirements: string[] = []

  if (title.length < 4) missingRequirements.push('需要给第一次任务一个明确标题。')
  if (taskBody.length < 20) missingRequirements.push('需要说明这个项目首先要解决什么任务。')

  const verdict = missingRequirements.length === 0 ? 'pass' : 'fail'
  return {
    compiled: {
      title,
      verifiableGoal: taskBody,
      acceptanceCriteria: [],
      evidenceRequirement: '首个节点只定义任务起点，不要求提交完成证明；后续推进节点会提交证据并接受智能合约审查。',
    },
    review: {
      id: `draft-review-${crypto.randomUUID()}`,
      verdict,
      summary:
        verdict === 'pass'
          ? '第一次任务定义已记录。它会作为项目起点，后续推进节点从这里展开。'
          : '第一次任务定义还不够清楚，暂时不能作为项目起点。',
      missingRequirements,
      createdAt: now(),
    },
  }
}

const criterionIsCovered = (contract: ExecutionContract, criterion: AcceptanceCriterion, index: number) => {
  const combined = `${contract.completionClaim ?? ''}\n${contract.evidenceText ?? ''}`
  const label = new RegExp(`(?:C|标准|验收)\\s*${index + 1}(?!\\d)`, 'i')
  const criterionStart = criterion.text.slice(0, Math.min(12, criterion.text.length))
  if (contract.smartContractId === 'skill-strict-self') return label.test(contract.evidenceText ?? '')
  return label.test(combined) || combined.includes(criterionStart)
}

const buildAIReview = (contract: ExecutionContract): AIReview => {
  const covered = contract.acceptanceCriteria.map((criterion, index) => criterionIsCovered(contract, criterion, index))
  const metCount = covered.filter(Boolean).length
  const combinedLength = `${contract.completionClaim ?? ''}${contract.evidenceText ?? ''}`.trim().length
  const minimumEvidenceLength = contract.smartContractId === 'skill-strict-self' ? 80 : 40
  const verdict: ReviewVerdict =
    combinedLength < minimumEvidenceLength || metCount === 0
      ? 'fail'
      : metCount === contract.acceptanceCriteria.length
        ? 'pass'
        : 'partial'
  const createdAt = now()

  return {
    id: `review-${crypto.randomUUID()}`,
    verdict,
    summary:
      verdict === 'pass'
        ? '智能合约审查通过。这次推进满足了冻结验收标准，确认后可以生成阶段完成记录。'
          : verdict === 'partial'
          ? '智能合约审查未通过。部分标准已有证明，但仍存在缺口；你可以继续补足，也可以选择带着该结论锁定。'
          : '智能合约审查未通过。当前提交不能证明冻结目标已经达成；你可以继续补足，也可以选择带着该结论锁定。',
    criterionReviews: contract.acceptanceCriteria.map((criterion, index) => ({
      criterionId: criterion.id,
      result: covered[index] ? 'met' : verdict === 'fail' ? 'unmet' : 'unclear',
      reason: covered[index]
        ? contract.smartContractId === 'skill-strict-self'
          ? '严格自证合约确认了证据区中与该标准一一对应的编号。'
          : '提交结果中存在该标准的直接说明或编号证据。'
        : contract.smartContractId === 'skill-strict-self'
          ? '严格自证合约要求在证据区用 C 编号逐条对应，当前没有找到该标准的编号证据。'
          : '没有找到与该冻结标准一一对应的结果或证据。',
    })),
    suggestedSupplementTitle:
      verdict === 'pass'
        ? undefined
        : `补齐「${contract.acceptanceCriteria.find((_, index) => !covered[index])?.text ?? contract.title}」`,
    createdAt,
  }
}

const cloneSeedProjects = () => projects.map((project) => ({ ...project, contractRevisions: [...project.contractRevisions] }))
const cloneSeedBranches = () => seedBranches.map((branch) => ({ ...branch }))

const legacySmartContractBody = (smartContract: LegacySmartContract) => {
  if (smartContract.body?.trim()) return smartContract.body.trim()

  const rules = smartContract.deploymentRules?.map((rule) => rule.trim()).filter(Boolean) ?? []
  const reviewPrinciple = smartContract.reviewPrinciple?.trim() ?? ''
  return [
    rules.length > 0 ? `## 部署规则\n\n${rules.map((rule) => `- ${rule}`).join('\n')}` : '',
    reviewPrinciple ? `## AI 审查原则\n\n${reviewPrinciple}` : '',
  ].filter(Boolean).join('\n\n') || '## 合约正文\n\n这份合约暂未填写正文。'
}

const normalizeSmartContract = (smartContract: LegacySmartContract): SmartContractDefinition => ({
  id: smartContract.id ?? `smart-contract-${crypto.randomUUID()}`,
  name: smartContract.name?.trim() || '未命名智能合约',
  source: smartContract.source ?? 'custom',
  version: smartContract.version ?? '1.0.0',
  description: smartContract.description?.trim() || '未填写适用成果。',
  body: legacySmartContractBody(smartContract),
})

const currentRevision = (project: Project) =>
  project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId) ?? project.contractRevisions[0]

const isActionableStage = (stage: ContractStage) => stage === 'frozen' || stage === 'verified' || stage === 'needs_supplement'

const currentContractForProject = (project: Project, allContracts: ExecutionContract[]) => {
  if (!project.currentContractId) return undefined
  const contract = allContracts.find((item) => item.id === project.currentContractId && item.projectId === project.id)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

const currentContractForBranch = (branch: ExecutionBranch, allContracts: ExecutionContract[]) => {
  if (!branch.currentContractId) return undefined
  const contract = allContracts.find((item) => item.id === branch.currentContractId && item.branchId === branch.id)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

const isCurrentContract = (
  project: Project,
  contract: ExecutionContract,
  allContracts: ExecutionContract[],
  allBranches: ExecutionBranch[],
) => {
  if (currentContractForProject(project, allContracts)?.id === contract.id) return true
  const branch = allBranches.find((item) => item.id === contract.branchId && item.projectId === project.id)
  return branch ? currentContractForBranch(branch, allContracts)?.id === contract.id : false
}

const deriveCurrentContractId = (project: Project, allContracts: ExecutionContract[]) => {
  const projectContracts = allContracts.filter((contract) => contract.projectId === project.id)
  const declaredCurrent = currentContractForProject(project, allContracts)
  if (declaredCurrent && !(project.visibility === 'private' && declaredCurrent.branchId) && !(declaredCurrent.stage === 'needs_supplement' && projectContracts.some((item) => item.supplementOfContractId === declaredCurrent.id))) {
    return declaredCurrent.id
  }

  // `null` is a deliberate closed-project state. Older persisted projects lack the field entirely.
  if (Object.prototype.hasOwnProperty.call(project, 'currentContractId') && project.currentContractId === null) return null
  if (project.visibility === 'public') return null

  return (
    projectContracts
    .filter((contract) => !contract.branchId)
    .filter((contract) => isActionableStage(contract.stage))
    .filter(
      (contract) =>
        contract.stage !== 'needs_supplement' || !projectContracts.some((item) => item.supplementOfContractId === contract.id),
    )
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]?.id ?? null
  )
}

const deriveBranchCurrentContractId = (branch: ExecutionBranch, allContracts: ExecutionContract[]) => {
  const branchContracts = allContracts.filter((contract) => contract.branchId === branch.id)
  const declaredCurrent = currentContractForBranch(branch, allContracts)
  if (declaredCurrent && !(declaredCurrent.stage === 'needs_supplement' && branchContracts.some((item) => item.supplementOfContractId === declaredCurrent.id))) {
    return declaredCurrent.id
  }

  if (Object.prototype.hasOwnProperty.call(branch, 'currentContractId') && branch.currentContractId === null) return null

  return (
    branchContracts
      .filter((contract) => isActionableStage(contract.stage))
      .filter(
        (contract) =>
          contract.stage !== 'needs_supplement' || !branchContracts.some((item) => item.supplementOfContractId === contract.id),
      )
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]?.id ?? null
  )
}

const reconcileProjectCurrentNodes = (projectList: Project[], allContracts: ExecutionContract[]) =>
  projectList.map((project) => ({
    ...project,
    currentContractId: deriveCurrentContractId(project, allContracts),
  }))

const reconcileBranchCurrentNodes = (branchList: ExecutionBranch[], allContracts: ExecutionContract[]) =>
  branchList.map((branch) => {
    const currentContractId = deriveBranchCurrentContractId(branch, allContracts)
    return {
      ...branch,
      currentContractId,
      headContractId: currentContractId ?? branch.headContractId ?? null,
    }
  })

const normalizeProject = (project: Project): Project => {
  const seededProject = projects.find((item) => item.id === project.id)
  const visibility = project.isDefault ? 'private' : project.visibility ?? seededProject?.visibility ?? 'private'
  return {
    ...project,
    visibility,
    currentContractId: project.currentContractId,
  }
}

const parentIdsFor = (contract: ExecutionContract) =>
  contract.sourceContractIds?.length
    ? contract.sourceContractIds
    : contract.parentContractId
      ? [contract.parentContractId]
      : []

const collectCoverageIds = (closingContract: ExecutionContract, allContracts: ExecutionContract[]) => {
  const byId = new Map(allContracts.map((contract) => [contract.id, contract]))
  const covered = new Set<string>()
  const visit = (contract: ExecutionContract | undefined) => {
    if (!contract || contract.projectId !== closingContract.projectId || covered.has(contract.id)) return
    if (contract.nodeKind !== 'task') covered.add(contract.id)
    if (contract.completionRecordId) return
    parentIdsFor(contract).forEach((parentId) => visit(byId.get(parentId)))
  }
  visit(closingContract)
  return allContracts
    .filter((contract) => covered.has(contract.id))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .map((contract) => contract.id)
}

const ensureCompletionRecords = (allContracts: ExecutionContract[], existingRecords: CompletionRecord[] = []) => {
  const records = existingRecords.map((record) => ({
    ...record,
    aiReviewVerdict:
      record.aiReviewVerdict ?? allContracts.find((contract) => contract.aiReview?.id === record.reviewId)?.aiReview?.verdict ?? 'pass',
  }))
  const recordById = new Map(records.map((record) => [record.id, record]))
  const updatedContracts = allContracts.map((contract) => {
    const record = records.find((item) => item.coveredContractIds.includes(contract.id))
    return record ? { ...contract, stage: 'completed' as const, completionRecordId: record.id } : contract
  })

  updatedContracts
    .forEach((contract) => {
      if (contract.stage !== 'completed' || !contract.aiReview || !contract.userVerdict) return
      if (contract.completionRecordId && recordById.has(contract.completionRecordId)) return
      const recordId = `record-${contract.id}`
      if (recordById.has(recordId)) return
      const record: CompletionRecord = {
        id: recordId,
        projectId: contract.projectId,
        closingContractId: contract.id,
        coveredContractIds: [contract.id],
        title: contract.title,
        summary:
          contract.aiReview.verdict === 'pass'
            ? '智能合约审查通过，并由本人确认写入完成记录。'
            : 'AI 审查未通过，但本人选择锁定这次推进；审查结论和锁定行为均已记录。',
        smartContractId: contract.smartContractId,
        smartContractVersion: contract.smartContractVersion,
        ruleHash: contract.ruleHash,
        reviewId: contract.aiReview.id,
        aiReviewVerdict: contract.aiReview.verdict,
        userVerdict: contract.userVerdict,
        createdAt: contract.userVerdict.createdAt,
      }
      records.push(record)
      recordById.set(record.id, record)
    })

  const completedByRecord = new Map<string, CompletionRecord>()
  records.forEach((record) => completedByRecord.set(record.id, record))
  return {
    contracts: updatedContracts.map((contract) => {
      const record = contract.completionRecordId
        ? completedByRecord.get(contract.completionRecordId)
        : records.find((item) => item.coveredContractIds.includes(contract.id))
      return record ? { ...contract, stage: 'completed' as const, completionRecordId: record.id } : contract
    }),
    completionRecords: records,
  }
}

const seededCompletionData = ensureCompletionRecords(contracts, seedCompletionRecords)

const initialState = {
  actors,
  currentActorId,
  isAuthenticated: false,
  accessToken: '',
  accountEmail: '',
  accountPassword: 'execgraph',
  projects,
  smartContracts,
  branches: seedBranches,
  contracts: seededCompletionData.contracts,
  completionRecords: seededCompletionData.completionRecords,
  edges,
}

const legacyProjectId = (contract: LegacyContract) => {
  if (contract.projectId) return contract.projectId
  if (contract.goalId === 'goal-product') return 'project-exec-graph'
  if (contract.goalId === 'goal-writing') return 'project-writing'
  return defaultProjectId
}

const migrationProjects = (legacyContracts: LegacyContract[]) => {
  const migrated = cloneSeedProjects()
  for (const contract of legacyContracts) {
    const project = migrated.find((item) => item.id === legacyProjectId(contract)) ?? migrated[0]
    const smartContractId = contract.smartContractId ?? contract.skillId ?? smartContracts[0].id
    const smartContractVersion = contract.smartContractVersion ?? contract.skillVersion ?? smartContracts[0].version
    const revisionExists = project.contractRevisions.some(
      (revision) => revision.smartContractId === smartContractId && revision.smartContractVersion === smartContractVersion,
    )
    if (!revisionExists) {
      project.contractRevisions.push({
        id: `legacy-${project.id}-${smartContractId}-${smartContractVersion}`,
        smartContractId,
        smartContractVersion,
        reason: '迁移旧节点的合约版本',
        activatedAt: contract.createdAt ?? now(),
      })
    }
  }
  return migrated
}

const migrateContract = (contract: LegacyContract, migratedProjects: Project[]): ExecutionContract => {
  const smartContractId = contract.smartContractId ?? contract.skillId ?? smartContracts[0].id
  const smartContractVersion = contract.smartContractVersion ?? contract.skillVersion ?? smartContracts[0].version
  const projectId = legacyProjectId(contract)
  const project = migratedProjects.find((item) => item.id === projectId) ?? migratedProjects[0]
  const matchingRevision = project.contractRevisions.find(
    (revision) => revision.smartContractId === smartContractId && revision.smartContractVersion === smartContractVersion,
  )
  const projectRevision = matchingRevision ?? currentRevision(project)
  const stageMap: Record<string, ContractStage> = {
    contracted: 'frozen',
    submitted: 'frozen',
    ai_reviewed: contract.aiReview?.verdict === 'pass' ? 'verified' : 'needs_supplement',
    user_confirmed: 'completed',
    closed: 'completed',
    frozen: 'frozen',
    verified: 'verified',
    needs_supplement: 'needs_supplement',
    completed: 'completed',
    task: 'task',
  }
  const stage = stageMap[contract.stage ?? 'frozen'] ?? 'frozen'
  const acceptanceCriteria = contract.acceptanceCriteria ?? []
  const evidenceRequirement = contract.evidenceRequirement ?? '提交完成结果，并逐条说明每项验收标准对应的证据。'

  return {
    ...(contract as ExecutionContract),
    projectId,
    projectContractRevisionId: contract.projectContractRevisionId ?? projectRevision.id,
    stage,
    nodeKind: contract.nodeKind ?? 'progress',
    sourceContractIds: contract.sourceContractIds ?? (contract.parentContractId ? [contract.parentContractId] : undefined),
    smartContractId,
    smartContractVersion,
    ruleHash:
      contract.ruleHash ??
      makeRuleHash(`${projectId}|${projectRevision.id}|${smartContractId}@${smartContractVersion}|${contract.verifiableGoal ?? ''}|${acceptanceCriteria.map((item) => item.text).join('|')}|${evidenceRequirement}`),
    acceptanceCriteria,
    evidenceRequirement,
    userVerdict: stage === 'completed' ? contract.userVerdict : undefined,
  }
}

const mergeSeedData = (state: LegacyState) => {
  if (!state.contracts || state.nodes) return initialState

  const migratedProjects = (state.projects?.length ? state.projects.map((project) => ({ ...project })) : migrationProjects(state.contracts)).map(
    normalizeProject,
  )
  const seededBranchByContractId = new Map(contracts.map((contract) => [contract.id, contract.branchId]))
  const migratedContracts = state.contracts
    .map((contract) => migrateContract(contract, migratedProjects))
    .map((contract) => ({ ...contract, branchId: contract.branchId ?? seededBranchByContractId.get(contract.id) }))
  const knownContractIds = new Set(migratedContracts.map((contract) => contract.id))
  const mergedContracts = [...migratedContracts, ...contracts.filter((contract) => !knownContractIds.has(contract.id))]
  const existingEdges = state.edges ?? []
  const knownEdgeIds = new Set(existingEdges.map((edge) => edge.id))
  const existingBranches = state.branches ?? []
  const knownBranchIds = new Set(existingBranches.map((branch) => branch.id))
  const mergedBranches = reconcileBranchCurrentNodes(
    [...existingBranches, ...cloneSeedBranches().filter((branch) => !knownBranchIds.has(branch.id))],
    mergedContracts,
  )
  const completionData = ensureCompletionRecords(mergedContracts, state.completionRecords?.length ? state.completionRecords : seedCompletionRecords)
  const existingSmartContracts = (state.smartContracts ?? []).map(normalizeSmartContract)
  const knownSmartContractIds = new Set(existingSmartContracts.map((contract) => contract.id))

  return {
    ...initialState,
    actors: state.actors ?? actors,
    currentActorId: state.currentActorId ?? currentActorId,
    isAuthenticated: state.isAuthenticated ?? false,
    accessToken: state.accessToken ?? '',
    accountEmail: state.accountEmail ?? '',
    accountPassword: state.accountPassword ?? 'execgraph',
    smartContracts: [...existingSmartContracts, ...smartContracts.filter((contract) => !knownSmartContractIds.has(contract.id))],
    projects: reconcileProjectCurrentNodes(migratedProjects, completionData.contracts),
    branches: mergedBranches,
    contracts: completionData.contracts,
    completionRecords: completionData.completionRecords,
    edges: [...existingEdges, ...edges.filter((edge) => !knownEdgeIds.has(edge.id))],
  }
}

export const useExecStore = create<ExecState>()(
  persist(
    (set, get) => ({
      ...initialState,
      createSmartContract: (input) => {
        const smartContract: SmartContractDefinition = {
          id: `smart-contract-${crypto.randomUUID()}`,
          name: input.name.trim(),
          source: 'custom',
          version: '1.0.0',
          description: input.description.trim(),
          body: input.body.trim(),
        }
        set((state) => ({ smartContracts: [...state.smartContracts, smartContract] }))
        return smartContract.id
      },
      createProject: (input) => {
        const smartContract = get().smartContracts.find((item) => item.id === input.smartContractId) ?? get().smartContracts[0]
        if (!smartContract) return null
        const projectId = `project-${crypto.randomUUID()}`
        const revision: ProjectContractRevision = {
          id: `project-revision-${crypto.randomUUID()}`,
          smartContractId: smartContract.id,
          smartContractVersion: smartContract.version,
          reason: '项目创建时选择的智能合约',
          activatedAt: now(),
        }
        const project: Project = {
          id: projectId,
          title: input.title.trim(),
          description: input.description.trim(),
          isDefault: false,
          visibility: input.visibility,
          currentContractId: null,
          activeContractRevisionId: revision.id,
          contractRevisions: [revision],
          createdAt: now(),
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return projectId
      },
      updateProject: (projectId, input) => {
        const title = input.title.trim()
        const description = input.description.trim()
        if (!title || !description) return

        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId && !project.archivedAt
              ? {
                  ...project,
                  title,
                  description,
                  visibility: project.isDefault ? 'private' : input.visibility,
                }
              : project,
          ),
        }))
      },
      upgradeProjectContract: (projectId, smartContractId) => {
        const smartContract = get().smartContracts.find((item) => item.id === smartContractId)
        const project = get().projects.find((item) => item.id === projectId)
        if (!project || project.archivedAt || !smartContract) return
        const active = currentRevision(project)
        if (active.smartContractId === smartContract.id && active.smartContractVersion === smartContract.version) return

        const revision: ProjectContractRevision = {
          id: `project-revision-${crypto.randomUUID()}`,
          smartContractId: smartContract.id,
          smartContractVersion: smartContract.version,
          reason: `从 ${active.smartContractId}@${active.smartContractVersion} 升级`,
          activatedAt: now(),
        }
        set((state) => ({
          projects: state.projects.map((item) =>
            item.id === projectId
              ? {
                  ...item,
                  activeContractRevisionId: revision.id,
                  contractRevisions: [revision, ...item.contractRevisions],
                }
              : item,
          ),
        }))
      },
      archiveProject: (projectId) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId && !project.isDefault && !project.archivedAt ? { ...project, archivedAt: now() } : project,
          ),
        }))
      },
      createContract: (input) => {
        const project = get().projects.find((item) => item.id === input.projectId) ?? get().projects.find((item) => item.id === defaultProjectId)
        if (!project) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '找不到项目，不能在没有项目合约的情况下开始行为。',
              missingRequirements: ['请选择一个存在的项目。'],
              createdAt: now(),
            },
          }
        }
        if (project.archivedAt) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '项目已归档，不能再开始或继续行为。',
              missingRequirements: ['归档项目仅保留查看和追溯功能。'],
              createdAt: now(),
            },
          }
        }

        const allContracts = get().contracts
        const projectContracts = allContracts.filter((contract) => contract.projectId === project.id)
        const sourceIds = [...new Set(input.sourceContractIds?.length ? input.sourceContractIds : input.parentContractId ? [input.parentContractId] : [])]
        const sourceContracts = sourceIds
          .map((sourceId) => allContracts.find((contract) => contract.id === sourceId))
          .filter((contract): contract is ExecutionContract => Boolean(contract))
        const parentContract = sourceContracts[0]
        const isConvergence = sourceIds.length > 1
        const invalidSources =
          sourceContracts.length !== sourceIds.length ||
          sourceContracts.some((contract) => contract.projectId !== project.id || (contract.nodeKind !== 'task' && (contract.stage !== 'completed' || !contract.completionRecordId)))
        if (invalidSources) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: isConvergence
                ? '不能开始汇合行动。只有同一项目中已经被完成记录锁定的节点，才能作为多个来源。'
                : '接续来源不可用。行为承诺只能从同一项目已签名完成的记录开始。',
              missingRequirements: isConvergence
                ? ['请至少选择两条已纳入完成记录的节点，再开始一项普通行动。']
                : ['请从已完成记录选择“继续”或“拆分新路径”。'],
              createdAt: now(),
            },
          }
        }

        let selectedBranch: ExecutionBranch | undefined
        let shouldCreateBranch = false
        if (isConvergence) {
          const hasCurrentProjectContract = currentContractForProject(project, allContracts)
          const hasCurrentBranchContract = get().branches.some(
            (branch) => branch.projectId === project.id && currentContractForBranch(branch, allContracts),
          )
          if (hasCurrentProjectContract || hasCurrentBranchContract) {
            return {
              draftReview: {
                id: `draft-review-${crypto.randomUUID()}`,
                verdict: 'fail',
                summary: '还有行为承诺尚未结算，暂时不能发起合并。',
                missingRequirements: ['先完成当前行为承诺，再把已通过的分支成果提交给合并审查。'],
                createdAt: now(),
              },
            }
          }
        } else if (project.visibility === 'private') {
          if (currentContractForProject(project, allContracts)) {
            return {
              draftReview: {
                id: `draft-review-${crypto.randomUUID()}`,
                verdict: 'fail',
                summary: '当前还有一项行为承诺尚未结算，不能同时开始新的行为承诺。',
                missingRequirements: ['请先提交证明、确认完成，或处理 AI 标出的证据缺口。'],
                createdAt: now(),
              },
            }
          }
          const selectedPrivateBranch = input.branchId
            ? get().branches.find((branch) => branch.id === input.branchId && branch.projectId === project.id)
            : undefined
          if (input.branchId && (!selectedPrivateBranch || !parentContract || selectedPrivateBranch.headContractId !== parentContract.id)) {
            return {
              draftReview: {
                id: `draft-review-${crypto.randomUUID()}`,
                verdict: 'fail',
                summary: '这条行为路径已经不是可继续的末端。',
                missingRequirements: ['请从该路径最新的已完成记录继续，或从完成记录拆分新路径。'],
                createdAt: now(),
              },
            }
          }
          if (selectedPrivateBranch) {
            selectedBranch = selectedPrivateBranch
            if (currentContractForBranch(selectedPrivateBranch, allContracts)) {
              return {
                draftReview: {
                  id: `draft-review-${crypto.randomUUID()}`,
                  verdict: 'fail',
                  summary: '这条行为路径还有一项承诺尚未结算。',
                  missingRequirements: ['请先结算这条路径当前的行为承诺。'],
                  createdAt: now(),
                },
              }
            }
          } else if (input.fork) {
            shouldCreateBranch = true
          } else {
            const latestCompleted = projectContracts
              .filter((contract) => contract.stage === 'completed')
              .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
            if (projectContracts.length > 0 && !parentContract) {
              return {
                draftReview: {
                  id: `draft-review-${crypto.randomUUID()}`,
                  verdict: 'fail',
                  summary: '继续行为必须从一条已完成记录开始。',
                  missingRequirements: ['打开完成记录，选择“继续下一项”或“拆分新路径”。'],
                  createdAt: now(),
                },
              }
            }
            if (parentContract && parentContract.nodeKind !== 'task' && latestCompleted?.id !== parentContract.id) {
              return {
                draftReview: {
                  id: `draft-review-${crypto.randomUUID()}`,
                  verdict: 'fail',
                  summary: '主线只能从最近一条已完成记录继续。',
                  missingRequirements: ['从最新完成记录继续，或明确选择“拆分新路径”。'],
                  createdAt: now(),
                },
              }
            }
          }
          if (input.fork && !selectedPrivateBranch) {
            shouldCreateBranch = true
          }
        } else {
          if (projectContracts.length > 0 && !parentContract) {
            return {
              draftReview: {
                id: `draft-review-${crypto.randomUUID()}`,
                verdict: 'fail',
                summary: '公开项目的新行为必须从一条已完成记录开始。',
                missingRequirements: ['打开完成记录，选择在路径上继续或拆分新路径。'],
                createdAt: now(),
              },
            }
          }
          if (input.branchId) {
            selectedBranch = get().branches.find((branch) => branch.id === input.branchId && branch.projectId === project.id)
            if (!selectedBranch) {
              return {
                draftReview: {
                  id: `draft-review-${crypto.randomUUID()}`,
                  verdict: 'fail',
                  summary: '找不到要继续的行为路径。',
                  missingRequirements: ['请从公开项目中的已完成记录发起继续或拆分。'],
                  createdAt: now(),
                },
              }
            }
            if (!parentContract || selectedBranch.headContractId !== parentContract.id) {
              return {
                draftReview: {
                  id: `draft-review-${crypto.randomUUID()}`,
                  verdict: 'fail',
                  summary: '行为路径只能从它最新的已完成记录继续。',
                  missingRequirements: ['请从该路径末端继续，或从其它完成记录拆分新路径。'],
                  createdAt: now(),
                },
              }
            }
          } else if (parentContract) {
            const parentBranch = get().branches.find((branch) => branch.id === parentContract.branchId)
            const canExtend =
              !input.fork &&
              parentBranch?.projectId === project.id &&
              parentBranch.headContractId === parentContract.id &&
              !currentContractForBranch(parentBranch, allContracts)
            if (canExtend) selectedBranch = parentBranch
            else shouldCreateBranch = true
          } else {
            shouldCreateBranch = true
          }

          if (selectedBranch && currentContractForBranch(selectedBranch, allContracts)) {
            return {
              draftReview: {
                id: `draft-review-${crypto.randomUUID()}`,
                verdict: 'fail',
                summary: '这条行为路径还有一项承诺尚未结算。',
                missingRequirements: ['请先结算当前承诺，或从其它已完成记录拆分新路径。'],
                createdAt: now(),
              },
            }
          }
        }

        const projectRevision = currentRevision(project)
        const smartContract =
          get().smartContracts.find((item) => item.id === projectRevision.smartContractId) ?? get().smartContracts[0]
        const nodeKind: ExecutionNodeKind = projectContracts.length === 0 && sourceIds.length === 0 ? 'task' : 'progress'
        const { review: draftReview, compiled } = nodeKind === 'task' ? buildTaskDraftReview(input.draft) : buildDraftReview(input.draft)
        if (draftReview.verdict === 'fail') return { draftReview }

        const contractId = `contract-${crypto.randomUUID()}`
        const createdBranch: ExecutionBranch | undefined =
          shouldCreateBranch
            ? {
                id: `branch-${crypto.randomUUID()}`,
                projectId: project.id,
                title: compiled.title,
                rootContractId: contractId,
                forkedFromContractId: parentContract?.id,
                headContractId: contractId,
                currentContractId: contractId,
                createdById: get().currentActorId,
                createdAt: now(),
              }
            : undefined
        const branch = selectedBranch ?? createdBranch
        const criteria = compiled.acceptanceCriteria.slice(0, 6)
        const ruleHash = makeRuleHash(
          `${project.id}|${projectRevision.id}|${smartContract.id}@${projectRevision.smartContractVersion}|${compiled.verifiableGoal}|${criteria.join('|')}|${compiled.evidenceRequirement}`,
        )
        const contract: ExecutionContract = {
          id: contractId,
          projectId: project.id,
          branchId: branch?.id,
          projectContractRevisionId: projectRevision.id,
          parentContractId: parentContract?.id,
          sourceContractIds: sourceIds.length > 0 ? sourceIds : undefined,
          title: compiled.title,
          nodeKind,
          stage: nodeKind === 'task' ? 'task' : 'frozen',
          originalIntent: input.draft.trim(),
          smartContractId: smartContract.id,
          smartContractVersion: projectRevision.smartContractVersion,
          ruleHash,
          verifiableGoal: compiled.verifiableGoal,
          acceptanceCriteria: criteria.map((criterion, index) => ({
            id: `c${index + 1}`,
            text: criterion,
            requiredEvidence: `C${index + 1}：提交能直接证明“${criterion}”的结果、链接、截图说明或前后对比。`,
          })),
          evidenceRequirement: compiled.evidenceRequirement,
          draftReview,
          reviewMessages: [
            {
              id: `msg-${crypto.randomUUID()}`,
              speaker: 'ai',
              body:
                nodeKind === 'task'
                  ? `第一次任务已通过项目「${project.title}」的智能合约「${smartContract.name}」校验。它会作为项目起点，规则指纹 ${ruleHash} 已记录。`
                  : `行为承诺已通过项目「${project.title}」的智能合约「${smartContract.name}」校验。目标、验收标准和证据要求已冻结，规则指纹 ${ruleHash} 已记录。`,
              createdAt: now(),
            },
          ],
          createdAt: now(),
          updatedAt: now(),
        }

        const relationType: ExecutionEdge['type'] = createdBranch ? 'fork' : 'lineage'
        const lineageEdges = sourceIds.map<ExecutionEdge>((sourceContractId) => ({
          id: `edge-${crypto.randomUUID()}`,
          sourceContractId,
          targetContractId: contract.id,
          type: relationType,
        }))

        set((state) => ({
          contracts: [contract, ...state.contracts],
          edges: lineageEdges.length > 0 ? [...state.edges, ...lineageEdges] : state.edges,
          branches: createdBranch
            ? [...state.branches, createdBranch]
            : branch
              ? state.branches.map((item) =>
                  item.id === branch.id ? { ...item, headContractId: contract.id, currentContractId: contract.id } : item,
                )
              : state.branches,
          projects: state.projects.map((item) =>
            item.id === project.id && ((nodeKind === 'task' && !branch) || isConvergence || (item.visibility === 'private' && !branch)) ? { ...item, currentContractId: contract.id } : item,
          ),
        }))
        return { contractId, draftReview }
      },
      submitCompletion: (contractId, input) => {
        set((state) => ({
          contracts: state.contracts.map((contract) => {
            const project = state.projects.find((item) => item.id === contract.projectId)
            if (!project || project.archivedAt || contract.id !== contractId || contract.stage !== 'frozen' || !isCurrentContract(project, contract, state.contracts, state.branches)) return contract

            const submittedContract: ExecutionContract = {
              ...contract,
              actorId: state.currentActorId,
              completionClaim: input.completionClaim.trim(),
              evidenceText: input.evidenceText.trim(),
            }
            const review = buildAIReview(submittedContract)
            const stage: ContractStage = review.verdict === 'pass' ? 'verified' : 'needs_supplement'

            return {
              ...submittedContract,
              stage,
              aiReview: review,
              reviewMessages: [
                ...contract.reviewMessages,
                {
                  id: `msg-${crypto.randomUUID()}`,
                  speaker: 'user',
                  body: input.completionClaim.trim(),
                  createdAt: now(),
                },
                {
                  id: `msg-${crypto.randomUUID()}`,
                  speaker: 'ai',
                  body: review.summary,
                  createdAt: review.createdAt,
                },
              ],
              updatedAt: now(),
            }
          }),
        }))
      },
      confirmCompletion: (contractId) => {
        const source = get().contracts.find((contract) => contract.id === contractId)
        const project = get().projects.find((item) => item.id === source?.projectId)
        const canLockStage = source?.stage === 'verified' || source?.stage === 'needs_supplement'
        if (!source || !project || project.archivedAt || !isCurrentContract(project, source, get().contracts, get().branches) || !canLockStage || !source.aiReview) return

        const createdAt = now()
        const aiReviewPassed = source.aiReview.verdict === 'pass'
        const verdict: UserVerdict = aiReviewPassed
          ? {
              result: 'confirmed_complete',
              note: '我确认 AI 审查通过的结果属实，并签名锁定这次推进覆盖的节点。',
              createdAt,
            }
          : {
              result: 'locked_with_ai_failure',
              note: '我已看到 AI 审查未通过的结论，仍选择锁定这次推进，并保留该审查结果。',
              createdAt,
            }
        const coveredContractIds = collectCoverageIds(source, get().contracts)
        const completionRecord: CompletionRecord = {
          id: `record-${crypto.randomUUID()}`,
          projectId: source.projectId,
          closingContractId: source.id,
          coveredContractIds,
          title: source.title,
          summary: aiReviewPassed
            ? `智能合约审查通过，并由本人确认；这条完成记录覆盖 ${coveredContractIds.length} 个推进节点。`
            : `AI 审查未通过，但本人选择锁定；这条记录覆盖 ${coveredContractIds.length} 个推进节点。`,
          smartContractId: source.smartContractId,
          smartContractVersion: source.smartContractVersion,
          ruleHash: source.ruleHash,
          reviewId: source.aiReview.id,
          aiReviewVerdict: source.aiReview.verdict,
          userVerdict: verdict,
          createdAt,
        }
        set((state) => ({
          contracts: state.contracts.map((contract) => {
            if (!coveredContractIds.includes(contract.id)) return contract
            if (contract.id === contractId) {
              return {
                ...contract,
                stage: 'completed',
                completionRecordId: completionRecord.id,
                userVerdict: verdict,
                reviewMessages: [
                  ...contract.reviewMessages,
                  {
                    id: `msg-${crypto.randomUUID()}`,
                    speaker: 'user' as const,
                    body: aiReviewPassed
                      ? '我签名确认：AI 审查通过，并锁定这次推进覆盖的节点。'
                      : '我已看到 AI 审查未通过，仍签名锁定这次推进覆盖的节点。',
                    createdAt: verdict.createdAt,
                  },
                ],
                updatedAt: createdAt,
              }
            }
            return { ...contract, stage: 'completed', completionRecordId: completionRecord.id }
          }),
          completionRecords: [completionRecord, ...state.completionRecords],
          projects: state.projects.map((item) =>
            item.id === source.projectId && item.currentContractId === source.id ? { ...item, currentContractId: null } : item,
          ),
          branches: state.branches.map((branch) =>
            branch.id === source.branchId ? { ...branch, headContractId: source.id, currentContractId: null } : branch,
          ),
        }))
      },
      createSupplementContract: (contractId) => {
        const source = get().contracts.find((contract) => contract.id === contractId)
        const project = get().projects.find((item) => item.id === source?.projectId)
        if (
          !source ||
          !project ||
          project.archivedAt ||
          !isCurrentContract(project, source, get().contracts, get().branches) ||
          source.stage !== 'needs_supplement' ||
          !source.aiReview?.suggestedSupplementTitle
        )
          return
        const existing = get().contracts.find((contract) => contract.supplementOfContractId === source.id)
        if (existing) return

        const unmetCriteria = source.acceptanceCriteria.filter((criterion) =>
          source.aiReview?.criterionReviews.some(
            (review) => review.criterionId === criterion.id && review.result !== 'met',
          ),
        )
        const criteria = unmetCriteria.length > 0 ? unmetCriteria : source.acceptanceCriteria
        const title = source.aiReview.suggestedSupplementTitle
        const evidenceRequirement = '提交能直接补足上述冻结标准缺口的结果，并按 C1、C2… 逐条标明证据位置。'
        const ruleHash = makeRuleHash(
          `${source.projectId}|${source.projectContractRevisionId}|${source.smartContractId}@${source.smartContractVersion}|${title}|${criteria.map((criterion) => criterion.text).join('|')}|${evidenceRequirement}`,
        )
        const supplement: ExecutionContract = {
          id: `contract-${crypto.randomUUID()}`,
          projectId: source.projectId,
          branchId: source.branchId,
          projectContractRevisionId: source.projectContractRevisionId,
          parentContractId: source.id,
          supplementOfContractId: source.id,
          title,
          stage: 'frozen',
          originalIntent: `智能合约对原行为「${source.title}」的审查未通过。本补足行为只处理被标记的缺口。`,
          smartContractId: source.smartContractId,
          smartContractVersion: source.smartContractVersion,
          ruleHash,
          verifiableGoal: title,
          acceptanceCriteria: criteria.map((criterion, index) => ({
            ...criterion,
            id: `c${index + 1}`,
            requiredEvidence: `C${index + 1}：${criterion.requiredEvidence}`,
          })),
          evidenceRequirement,
          draftReview: {
            id: `draft-review-${crypto.randomUUID()}`,
            verdict: 'pass',
            summary: '补足行为由智能合约的未通过审查结果生成，继承原行为的项目合约版本并立即开始。',
            missingRequirements: [],
            createdAt: now(),
          },
          reviewMessages: [
            {
              id: `msg-${crypto.randomUUID()}`,
              speaker: 'ai',
              body: `该补足行为继承项目合约版本与规则指纹 ${ruleHash}，只用于处理原行为未满足的标准。`,
              createdAt: now(),
            },
          ],
          createdAt: now(),
          updatedAt: now(),
        }

        const supplementEdge: ExecutionEdge = {
          id: `edge-${crypto.randomUUID()}`,
          sourceContractId: source.id,
          targetContractId: supplement.id,
          type: 'supplement',
        }

        set((state) => ({
          contracts: [...state.contracts, supplement],
          edges: [...state.edges, supplementEdge],
          projects: state.projects.map((item) =>
            item.id === source.projectId && (item.currentContractId === source.id || (item.visibility === 'private' && !source.branchId)) ? { ...item, currentContractId: supplement.id } : item,
          ),
          branches: state.branches.map((branch) =>
            branch.id === source.branchId ? { ...branch, headContractId: supplement.id, currentContractId: supplement.id } : branch,
          ),
        }))
      },
      signIn: (email, password) => {
        if (!email.trim() || !password.trim()) {
          return { success: false, message: '请输入邮箱和密码。' }
        }
        const normalizedEmail = email.trim().toLowerCase()
        const isDemoAccount = normalizedEmail === 'demo@execgraph.local' && password === 'execgraph'
        if (!isDemoAccount && password !== get().accountPassword) {
          return { success: false, message: '邮箱或密码不正确。' }
        }
        set({ isAuthenticated: true, accountEmail: normalizedEmail, accountPassword: isDemoAccount ? 'execgraph' : get().accountPassword })
        return { success: true }
      },
      registerAccount: (username, email, password) => {
        if (!username.trim() || !email.trim() || !password.trim()) {
          return { success: false, message: '请完整填写用户名、邮箱和密码。' }
        }
        const normalizedEmail = email.trim().toLowerCase()
        const normalizedUsername = username.trim().replace(/^@+/, '')
        set((state) => ({
          isAuthenticated: true,
          accountEmail: normalizedEmail,
          accountPassword: password,
          actors: state.actors.map((actor) =>
            actor.id === state.currentActorId
              ? {
                  ...actor,
                  name: normalizedUsername,
                  handle: `@${normalizedUsername}`,
                }
              : actor,
          ),
        }))
        return { success: true }
      },
      setAccessToken: (token) => set({ accessToken: token }),
      signOut: () => set({ isAuthenticated: false, accessToken: '' }),
      updateProfile: (input) => {
        const normalizedUsername = input.handle.trim().replace(/^@+/, '')
        set((state) => ({
          actors: state.actors.map((actor) =>
            actor.id === state.currentActorId
              ? {
                  ...actor,
                  name: normalizedUsername,
                  handle: `@${normalizedUsername}`,
                  bio: input.bio.trim(),
                  gender: input.gender,
                  avatarUrl: input.avatarUrl,
                }
              : actor,
          ),
        }))
      },
      updateAccountEmail: (email, currentPassword) => {
        if (currentPassword !== get().accountPassword) {
          return { success: false, message: '当前密码不正确。' }
        }
        set({ accountEmail: email.trim().toLowerCase() })
        return { success: true }
      },
      updateAccountPassword: (currentPassword, nextPassword) => {
        if (currentPassword !== get().accountPassword) {
          return { success: false, message: '当前密码不正确。' }
        }
        if (nextPassword.length < 6) {
          return { success: false, message: '新密码至少需要 6 个字符。' }
        }
        set({ accountPassword: nextPassword })
        return { success: true }
      },
      resetDemo: () =>
        set((state) => ({
          ...initialState,
          actors: state.actors,
          currentActorId: state.currentActorId,
          isAuthenticated: state.isAuthenticated,
          accessToken: state.accessToken,
          accountEmail: state.accountEmail,
          accountPassword: state.accountPassword,
        })),
    }),
    {
      name: 'exec-graph-demo',
      version: 17,
      migrate: (persistedState) => mergeSeedData(persistedState as LegacyState),
    },
  ),
)
