import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { actors, branches as seedBranches, completionRecords as seedCompletionRecords, contracts, currentActorId, defaultProjectId, edges, projects, smartContracts } from '../data/seed'
import { isActionableStage, needsReviewDecision } from '../lib/execution'
import type {
  AIReview,
  Actor,
  CompletionRecord,
  ContractStage,
  DraftReview,
  ExecutionBranch,
  ExecutionContract,
  ExecutionEdge,
  Gender,
  Project,
  ProjectType,
  ProjectContractRevision,
  SmartContractDefinition,
} from '../types'

type SubmitCompletionInput = {
  completionClaim: string
  evidenceText: string
}

type ReviewClarificationInput = {
  criterionIds: string[]
  explanation: string
  evidenceReferences?: string
  evidenceAddition?: string
  evidencePredatesSubmission?: boolean
}

type CreateContractInput = {
  projectId: string
  draft: string
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
  closureSourceIds?: string[]
  supplementOfContractId?: string
  retryOfContractId?: string
  draftReview?: DraftReview
  planningConversationId?: string
}

type ReviewNodeDraftInput = {
  projectId: string
  draft: string
}

type CreateProjectInput = {
  title: string
  description: string
  projectType: ProjectType
  projectRules: string
  visibility: 'private' | 'public'
  aiKeyId: string
	contributionCallId?: string
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

type ProjectStateResponse = {
  project: Project
  nodes: ExecutionContract[]
  edges: ExecutionEdge[]
  branches: ExecutionBranch[]
  completionRecords: CompletionRecord[]
}

type AuthResult = {
  success: boolean
  message?: string
}

type ProfileInput = {
	username: string
	userId: string
  bio: string
  gender: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
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
  createProject: (input: CreateProjectInput) => Promise<string | null>
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<AuthResult>
  createSmartContract: (input: CreateSmartContractInput) => Promise<string | null>
  deleteSmartContract: (contractId: string) => Promise<AuthResult>
  upgradeProjectContract: (projectId: string, smartContractId: string) => Promise<AuthResult>
  archiveProject: (projectId: string) => Promise<AuthResult>
  restoreProject: (projectId: string) => Promise<AuthResult>
  deleteProject: (projectId: string) => Promise<AuthResult>
  reviewNodeDraft: (input: ReviewNodeDraftInput) => Promise<CreateContractResult>
  createContract: (input: CreateContractInput) => Promise<CreateContractResult>
  submitCompletion: (contractId: string, input: SubmitCompletionInput) => Promise<AuthResult>
  submitReviewClarification: (contractId: string, input: ReviewClarificationInput) => Promise<AuthResult>
  confirmCompletion: (contractId: string) => Promise<AuthResult>
  createSupplementContract: (contractId: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => AuthResult
	registerAccount: (username: string, userId: string, email: string, password: string) => AuthResult
  setAccessToken: (token: string) => void
  refreshWorkspace: () => Promise<AuthResult>
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
          ? '节点草案审核通过。这个行动将遵循项目规则，并冻结目标、验收标准和证据要求。'
          : '节点草案审核未通过。此草案尚不能成为项目中的推进节点，请按平台规则补全后再提交。',
      missingRequirements,
      createdAt: now(),
    },
  }
}

const requestNodeDraftReview = async (accessToken: string, project: Project, smartContract: SmartContractDefinition, draft: string, compiled: CompiledDraft) => {
  const response = await fetch('/api/ai-reviews/node-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        projectType: project.projectType,
        projectRules: project.projectRules,
      },
      smartContract: {
        id: smartContract.id,
        name: smartContract.name,
        description: smartContract.description,
        body: smartContract.body,
      },
      draft: draft.trim(),
      title: compiled.title,
      verifiableGoal: compiled.verifiableGoal,
      acceptanceCriteria: compiled.acceptanceCriteria,
      evidenceRequirement: compiled.evidenceRequirement,
    }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; review?: DraftReview }
  if (!response.ok || !data.review) {
    throw new Error(data.error ?? `节点草案审核失败（HTTP ${response.status}）。`)
  }
  return data.review
}

const requestRealAIReview = async (accessToken: string, contract: ExecutionContract, input: SubmitCompletionInput) => {
  const response = await fetch('/api/ai-reviews/node', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      nodeId: contract.id,
      completionClaim: input.completionClaim.trim(),
      evidenceText: input.evidenceText.trim(),
    }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; review?: AIReview }
  if (!response.ok || !data.review) {
    throw new Error(data.error ?? `AI 审查失败（HTTP ${response.status}）。`)
  }
  return data.review
}

const requestReviewClarification = async (accessToken: string, contract: ExecutionContract, input: ReviewClarificationInput) => {
  const response = await fetch('/api/ai-reviews/node/clarification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      nodeId: contract.id,
      criterionIds: input.criterionIds,
      explanation: input.explanation.trim(),
      evidenceReferences: input.evidenceReferences?.trim() ?? '',
      evidenceAddition: input.evidenceAddition?.trim() ?? '',
      evidencePredatesSubmission: input.evidencePredatesSubmission ?? false,
    }),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string; review?: AIReview }
  if (!response.ok || !data.review) {
    throw new Error(data.error ?? `补充审查失败（HTTP ${response.status}）。`)
  }
  return data.review
}

const requestProjectState = async (accessToken: string, path: string, init?: RequestInit) => {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })
  const data = (await response.json().catch(() => ({}))) as ProjectStateResponse & { error?: string }
  if (!response.ok || !data.project) throw new Error(data.error ?? `项目操作失败（HTTP ${response.status}）。`)
  return data
}

const normalizeExecutionContract = (contract: ExecutionContract): ExecutionContract => ({
  ...contract,
  actorId: contract.actorId === undefined || contract.actorId === null ? undefined : String(contract.actorId),
})

const mergeProjectState = (state: Pick<ExecState, 'projects' | 'contracts' | 'branches' | 'completionRecords' | 'edges'>, snapshot: ProjectStateResponse) => ({
  projects: state.projects.map((project) => (project.id === snapshot.project.id ? snapshot.project : project)),
  contracts: [...state.contracts.filter((contract) => contract.projectId !== snapshot.project.id), ...snapshot.nodes.map(normalizeExecutionContract)],
  branches: [...state.branches.filter((branch) => branch.projectId !== snapshot.project.id), ...snapshot.branches],
  completionRecords: [...state.completionRecords.filter((record) => record.projectId !== snapshot.project.id), ...snapshot.completionRecords],
  edges: [
    ...state.edges.filter((edge) => !state.contracts.some((contract) => contract.projectId === snapshot.project.id && (contract.id === edge.sourceContractId || contract.id === edge.targetContractId))),
    ...snapshot.edges,
  ],
})

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
  const projectType = project.projectType ?? seededProject?.projectType ?? 'guided'
  const projectRules = project.projectRules ?? seededProject?.projectRules ?? ''
  return {
    ...project,
    visibility,
    projectType,
    projectRules,
    currentContractId: project.currentContractId,
  }
}

const ensureCompletionRecords = (allContracts: ExecutionContract[], existingRecords: CompletionRecord[] = []) => {
  const records = existingRecords.map((record) => ({
    ...record,
    aiReviewVerdict:
      record.aiReviewVerdict ?? allContracts.find((contract) => contract.aiReview?.id === record.reviewId)?.aiReview?.verdict ?? 'pass',
    recordKind: record.recordKind ?? (record.aiReviewVerdict === 'pass' ? 'accepted' : 'sealed'),
  }))
  const recordById = new Map(records.map((record) => [record.id, record]))
  const updatedContracts = allContracts.map((contract) => {
    const record = records.find((item) => item.coveredContractIds.includes(contract.id))
    return record ? { ...contract, stage: record.recordKind === 'sealed' ? ('sealed' as const) : ('completed' as const), completionRecordId: record.id } : contract
  })

  updatedContracts
    .forEach((contract) => {
      if ((contract.stage !== 'completed' && contract.stage !== 'sealed') || !contract.aiReview || !contract.userVerdict) return
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
            : 'AI 审查仍有缺口，本人决定封存这次推进；审查结论和行动证据均已保留。',
        smartContractId: contract.smartContractId,
        smartContractVersion: contract.smartContractVersion,
        ruleHash: contract.ruleHash,
        reviewId: contract.aiReview.id,
        aiReviewVerdict: contract.aiReview.verdict,
        recordKind: contract.aiReview.verdict === 'pass' ? 'accepted' : 'sealed',
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
      return record ? { ...contract, stage: record.recordKind === 'sealed' ? ('sealed' as const) : ('completed' as const), completionRecordId: record.id } : contract
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
  const wasTaskNode = contract.nodeKind === 'task' || contract.stage === 'task'
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
    sealed: 'sealed',
    task: 'frozen',
  }
  const stage = stageMap[contract.stage ?? 'frozen'] ?? 'frozen'
  const acceptanceCriteria =
    contract.acceptanceCriteria?.length
      ? contract.acceptanceCriteria
      : wasTaskNode
        ? [
            {
              id: 'c1',
              text: '完成这个节点草案中描述的第一项推进，并提交可检查的结果说明。',
              requiredEvidence: '提交本次推进留下的产出、链接、截图说明或前后对比。',
            },
          ]
        : []
  const evidenceRequirement = wasTaskNode
    ? '提交本次推进留下的产出、链接、截图说明或前后对比。'
    : contract.evidenceRequirement ?? '提交完成结果，并逐条说明每项验收标准对应的证据。'

  return {
    ...(contract as ExecutionContract),
    projectId,
    projectContractRevisionId: contract.projectContractRevisionId ?? projectRevision.id,
    stage,
    nodeKind: contract.nodeKind === 'task' ? 'progress' : contract.nodeKind ?? 'progress',
    sourceContractIds: contract.sourceContractIds ?? (contract.parentContractId ? [contract.parentContractId] : undefined),
    smartContractId,
    smartContractVersion,
    ruleHash:
      contract.ruleHash ??
      makeRuleHash(`${projectId}|${projectRevision.id}|${smartContractId}@${smartContractVersion}|${contract.verifiableGoal ?? ''}|${acceptanceCriteria.map((item) => item.text).join('|')}|${evidenceRequirement}`),
    acceptanceCriteria,
    evidenceRequirement,
    userVerdict: stage === 'completed' || stage === 'sealed' ? contract.userVerdict : undefined,
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
      createSmartContract: async (input) => {
        const accessToken = get().accessToken
        if (!accessToken) return null
        try {
          const response = await fetch('/api/smart-contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify(input),
          })
          const contract = (await response.json().catch(() => ({}))) as SmartContractDefinition & { error?: string }
          if (!response.ok || !contract.id) return null
          set((state) => ({ smartContracts: [...state.smartContracts.filter((item) => item.id !== contract.id), contract] }))
          return contract.id
        } catch {
          return null
        }
      },
      deleteSmartContract: async (contractId) => {
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '请先登录后再删除智能合约。' }
        try {
          const response = await fetch(`/api/smart-contracts/${contractId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
          const data = (await response.json().catch(() => ({}))) as { error?: string }
          if (!response.ok) return { success: false, message: data.error ?? '删除智能合约失败。' }
          set((state) => ({ smartContracts: state.smartContracts.filter((contract) => contract.id !== contractId) }))
          return { success: true }
        } catch {
          return { success: false, message: '无法连接服务，请确认后端已启动。' }
        }
      },
      createProject: async (input) => {
        if (get().accessToken) {
          try {
            const response = await fetch('/api/projects', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${get().accessToken}` },
              body: JSON.stringify(input),
            })
            const project = (await response.json().catch(() => ({}))) as Project & { error?: string }
            if (!response.ok || !project.id) throw new Error(project.error ?? `项目创建失败（HTTP ${response.status}）。`)
            set((state) => ({ projects: [...state.projects.filter((item) => item.id !== project.id), project] }))
            return project.id
          } catch (error) {
            throw error instanceof Error ? error : new Error('无法连接服务，请确认后端已启动。')
          }
        }
        const smartContract = get().smartContracts.find((item) => item.id === 'skill-general-contract') ?? get().smartContracts[0]
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
          projectType: input.projectType,
          projectRules: input.projectRules.trim(),
          currentContractId: null,
          activeContractRevisionId: revision.id,
          contractRevisions: [revision],
          createdAt: now(),
        }
        set((state) => ({ projects: [...state.projects, project] }))
        return projectId
      },
      updateProject: async (projectId, input) => {
        const title = input.title.trim()
        const description = input.description.trim()
        if (!title || !description) return { success: false, message: '项目名称和描述不能为空。' }
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '请先登录后再修改项目。' }
        try {
          const snapshot = await requestProjectState(accessToken, `/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify({ title, description, visibility: input.visibility }) })
          set((state) => mergeProjectState(state, snapshot))
          return { success: true }
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : '保存项目资料失败。' }
        }
      },
      upgradeProjectContract: async (projectId, smartContractId) => {
		const smartContract = get().smartContracts.find((item) => item.id === smartContractId)
		const project = get().projects.find((item) => item.id === projectId)
		if (!project || project.archivedAt || !smartContract) return { success: false, message: '当前项目不能修改智能合约。' }
		const active = currentRevision(project)
		if (active.smartContractId === smartContract.id && active.smartContractVersion === smartContract.version) return { success: false, message: '该合约已经是项目当前配置。' }
		const accessToken = get().accessToken
		if (!accessToken) return { success: false, message: '请先登录后再修改项目智能合约。' }
		try {
			const snapshot = await requestProjectState(accessToken, `/api/projects/${projectId}/smart-contract`, {
				method: 'POST',
				body: JSON.stringify({ smartContractId }),
			})
			set((state) => mergeProjectState(state, snapshot))
			return { success: true }
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : '更新项目智能合约失败。' }
		}
      },
      archiveProject: async (projectId) => {
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '请先登录后再归档项目。' }
        try {
          const response = await fetch(`/api/projects/${projectId}/archive`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
          const data = await response.json().catch(() => ({})) as { error?: string }
          if (!response.ok) return { success: false, message: data.error ?? '归档项目失败。' }
          await get().refreshWorkspace()
          return { success: true }
        } catch (error) { return { success: false, message: error instanceof Error ? error.message : '归档项目失败。' } }
      },
      restoreProject: async (projectId) => {
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '请先登录后再恢复项目。' }
        try {
          const response = await fetch(`/api/projects/${projectId}/unarchive`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
          const data = await response.json().catch(() => ({})) as { error?: string }
          if (!response.ok) return { success: false, message: data.error ?? '恢复项目失败。' }
          await get().refreshWorkspace()
          return { success: true }
        } catch (error) { return { success: false, message: error instanceof Error ? error.message : '恢复项目失败。' } }
      },
      deleteProject: async (projectId) => {
        const project = get().projects.find((item) => item.id === projectId)
        if (!project || project.isDefault) return { success: false, message: '默认项目不能删除。' }
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '请先登录后再删除项目。' }
        try {
          const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
          const data = await response.json().catch(() => ({})) as { error?: string }
          if (!response.ok) return { success: false, message: data.error ?? '删除项目失败。' }
        const contractIds = new Set(get().contracts.filter((contract) => contract.projectId === projectId).map((contract) => contract.id))
        set((state) => ({
          projects: state.projects.filter((item) => item.id !== projectId),
          contracts: state.contracts.filter((contract) => contract.projectId !== projectId),
          branches: state.branches.filter((branch) => branch.projectId !== projectId),
          completionRecords: state.completionRecords.filter((record) => record.projectId !== projectId),
          edges: state.edges.filter((edge) => !contractIds.has(edge.sourceContractId) && !contractIds.has(edge.targetContractId)),
        }))
		  return { success: true }
        } catch (error) { return { success: false, message: error instanceof Error ? error.message : '删除项目失败。' } }
      },
      reviewNodeDraft: async (input) => {
        const project = get().projects.find((item) => item.id === input.projectId) ?? get().projects.find((item) => item.id === defaultProjectId)
        if (!project) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '找不到项目，不能审核节点草案。',
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
              summary: '项目已归档，不能审核新的推进节点。',
              missingRequirements: ['归档项目仅保留查看和追溯功能。'],
              createdAt: now(),
            },
          }
        }
        const localReview = buildDraftReview(input.draft)
        if (localReview.review.verdict === 'fail') return { draftReview: localReview.review }
        if (!get().accessToken) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '节点草案需要 AI 审核后才能创建。',
              missingRequirements: ['请先登录，并为项目选择审查 AI。'],
              createdAt: now(),
            },
          }
        }
        const projectRevision = currentRevision(project)
        const smartContract = get().smartContracts.find((item) => item.id === projectRevision.smartContractId) ?? get().smartContracts[0]
        if (!smartContract) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '找不到平台基础审查规则，不能审核节点草案。',
              missingRequirements: ['请检查后端的基础审查规则配置。'],
              createdAt: now(),
            },
          }
        }
        try {
          const draftReview = await requestNodeDraftReview(get().accessToken, project, smartContract, input.draft, localReview.compiled)
          return { draftReview }
        } catch (error) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: error instanceof Error ? error.message : '节点草案审核失败，请稍后重试。',
              missingRequirements: ['请检查项目审查 AI、模型和后端服务。'],
              createdAt: now(),
            },
          }
        }
      },
      createContract: async (input) => {
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
        const isClosure = input.closureSourceIds?.length === 1 && input.closureSourceIds[0] === sourceIds[0] && sourceIds.length === 1
        const isClosureSource = isClosure && Boolean(parentContract) && parentContract?.stage === 'frozen' && isCurrentContract(project, parentContract, allContracts, get().branches)
        const isSupplement = Boolean(input.supplementOfContractId) && input.supplementOfContractId === sourceIds[0] && sourceIds.length === 1
        const isSupplementSource = isSupplement && Boolean(parentContract) && parentContract?.stage === 'needs_supplement' && isCurrentContract(project, parentContract, allContracts, get().branches)
        const isReplacementSource = isClosureSource || isSupplementSource
        const invalidSources =
          sourceContracts.length !== sourceIds.length ||
          sourceContracts.some((contract) => contract.projectId !== project.id || (!isReplacementSource && (contract.stage !== 'completed' || !contract.completionRecordId)))
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
          if (currentContractForProject(project, allContracts) && !isReplacementSource) {
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
            if (currentContractForBranch(selectedPrivateBranch, allContracts) && !isReplacementSource) {
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
            if (projectContracts.length > 0 && !parentContract && !input.retryOfContractId) {
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
            if (!isReplacementSource && parentContract && latestCompleted?.id !== parentContract.id) {
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
          if (projectContracts.length > 0 && !parentContract && !input.retryOfContractId) {
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

          if (selectedBranch && currentContractForBranch(selectedBranch, allContracts) && !isReplacementSource) {
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

        const localDraft = buildDraftReview(input.draft)
        const compiled = localDraft.compiled
        if (localDraft.review.verdict === 'fail') return { draftReview: localDraft.review }
        if (!input.draftReview) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '节点草案需要 AI 审核后才能创建。',
              missingRequirements: ['请使用页面上的“AI 审核并创建推进节点”完成审核。'],
              createdAt: now(),
            },
          }
        }
        const draftReview = input.draftReview
        if (draftReview.verdict === 'fail') return { draftReview }

        const criteria = compiled.acceptanceCriteria
        if (!get().accessToken) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: '请先登录后再创建推进节点。',
              missingRequirements: ['登录后才能把节点与 AI 审查结果写入项目链。'],
              createdAt: now(),
            },
          }
        }
        try {
          const snapshot = await requestProjectState(get().accessToken, `/api/projects/${project.id}/nodes`, {
            method: 'POST',
            body: JSON.stringify({
              draft: input.draft.trim(),
              draftReview,
              title: compiled.title,
              verifiableGoal: compiled.verifiableGoal,
              acceptanceCriteria: criteria.map((criterion, index) => ({
                id: `c${index + 1}`,
                text: criterion,
                requiredEvidence: `C${index + 1}：提交能直接证明“${criterion}”的结果、链接、截图说明或前后对比。`,
              })),
              evidenceRequirement: compiled.evidenceRequirement,
              parentContractId: parentContract?.id,
              sourceContractIds: sourceIds,
              branchId: selectedBranch?.id,
              fork: shouldCreateBranch,
              closure: isClosure,
              supplementOfContractId: input.supplementOfContractId,
              retryOfContractId: input.retryOfContractId,
              planningConversationId: input.planningConversationId,
            }),
          })
          const created = snapshot.nodes.find((node) => node.originalIntent === input.draft.trim() && node.title === compiled.title)
          set((state) => mergeProjectState(state, snapshot))
          if (!created) throw new Error('节点已保存，但未能读取新节点编号。')
          return { contractId: created.id, draftReview }
        } catch (error) {
          return {
            draftReview: {
              id: `draft-review-${crypto.randomUUID()}`,
              verdict: 'fail',
              summary: error instanceof Error ? error.message : '节点创建失败，请稍后重试。',
              missingRequirements: ['请检查后端服务，并重新提交已通过审核的草案。'],
              createdAt: now(),
            },
          }
        }
      },
      submitCompletion: async (contractId, input) => {
        const state = get()
        const contract = state.contracts.find((item) => item.id === contractId)
        const project = state.projects.find((item) => item.id === contract?.projectId)
        if (!contract || !project || project.archivedAt || contract.stage !== 'frozen' || !isCurrentContract(project, contract, state.contracts, state.branches)) {
          return { success: false, message: '当前节点不能提交审查。' }
        }
        if (!state.accessToken) {
          return { success: false, message: '请先登录，并为项目选择审查 AI。' }
        }

        try {
          await requestRealAIReview(state.accessToken, contract, input)
          const snapshot = await requestProjectState(state.accessToken, `/api/projects/${project.id}/graph`)
          set((latestState) => mergeProjectState(latestState, snapshot))
          return { success: true }
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : 'AI 审查失败，请稍后重试。' }
        }
      },
      submitReviewClarification: async (contractId, input) => {
        const state = get()
        const contract = state.contracts.find((item) => item.id === contractId)
        const project = state.projects.find((item) => item.id === contract?.projectId)
        const canReview = Boolean(contract && needsReviewDecision(contract))
        if (!contract || !project || project.archivedAt || !contract.aiReview || !canReview || !isCurrentContract(project, contract, state.contracts, state.branches)) {
          return { success: false, message: '当前节点不能补充审查说明。' }
        }
        if (!input.criterionIds.length || (input.explanation.trim().length < 4 && (input.evidenceAddition?.trim().length ?? 0) < 20)) {
          return { success: false, message: '请选择需复审的验收标准，并补充说明或提交前已存在的证据。' }
        }
        if (!state.accessToken) return { success: false, message: '请先登录，并为项目选择审查 AI。' }

        try {
          await requestReviewClarification(state.accessToken, contract, input)
          const snapshot = await requestProjectState(state.accessToken, `/api/projects/${project.id}/graph`)
          set((latestState) => mergeProjectState(latestState, snapshot))
          return { success: true }
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : '补充审查失败，请稍后重试。' }
        }
      },
      confirmCompletion: async (contractId) => {
        const source = get().contracts.find((contract) => contract.id === contractId)
        const project = get().projects.find((item) => item.id === source?.projectId)
        const canLockStage = Boolean(source && needsReviewDecision(source))
        if (!source || !project || project.archivedAt || !isCurrentContract(project, source, get().contracts, get().branches) || !canLockStage || !source.aiReview) {
          return { success: false, message: '当前节点不能锁定。' }
        }
        if (!get().accessToken) return { success: false, message: '请先登录后再锁定节点。' }
        try {
          const snapshot = await requestProjectState(get().accessToken, `/api/projects/${project.id}/nodes/${source.id}/lock`, { method: 'POST' })
          set((state) => mergeProjectState(state, snapshot))
          return { success: true }
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : '锁定节点失败，请稍后重试。' }
        }
      },
      createSupplementContract: async (contractId) => {
        const source = get().contracts.find((contract) => contract.id === contractId)
        const project = get().projects.find((item) => item.id === source?.projectId)
        if (
          !source ||
          !project ||
          project.archivedAt ||
          !isCurrentContract(project, source, get().contracts, get().branches) ||
          source.stage !== 'needs_supplement' ||
          !source.aiReview?.suggestedSupplementTitle
        ) return { success: false, message: '当前节点不能生成补足推进。' }
        const existing = get().contracts.find((contract) => contract.supplementOfContractId === source.id)
        if (existing) return { success: false, message: '这项节点已经有补足推进。' }
        if (!get().accessToken) return { success: false, message: '请先登录后再生成补足推进。' }

        const unmetCriteria = source.acceptanceCriteria.filter((criterion) =>
          source.aiReview?.criterionReviews.some(
            (review) => review.criterionId === criterion.id && review.result !== 'met',
          ),
        )
        const criteria = unmetCriteria.length > 0 ? unmetCriteria : source.acceptanceCriteria
        const title = source.aiReview.suggestedSupplementTitle
        const evidenceRequirement = '提交能直接补足上述冻结标准缺口的结果，并按 C1、C2… 逐条标明证据位置。'
        const draftReview: DraftReview = {
          id: `draft-review-${crypto.randomUUID()}`,
          verdict: 'pass',
          summary: '补足推进由上一节点的 AI 审查缺口生成，继承原节点冻结的规则。',
          missingRequirements: [],
          createdAt: now(),
        }
        const originalIntent = `智能合约对原行为「${source.title}」的审查未通过。本补足行为只处理被标记的缺口。`
        try {
          const snapshot = await requestProjectState(get().accessToken, `/api/projects/${source.projectId}/nodes`, {
            method: 'POST',
            body: JSON.stringify({
              draft: originalIntent,
              draftReview,
              title,
              verifiableGoal: title,
              acceptanceCriteria: criteria.map((criterion, index) => ({
                ...criterion,
                id: `c${index + 1}`,
                requiredEvidence: `C${index + 1}：${criterion.requiredEvidence}`,
              })),
              evidenceRequirement,
              parentContractId: source.id,
              sourceContractIds: [source.id],
              branchId: source.branchId,
              fork: false,
              supplementOfContractId: source.id,
            }),
          })
          set((state) => mergeProjectState(state, snapshot))
          return { success: true }
        } catch (error) {
          return { success: false, message: error instanceof Error ? error.message : '生成补足推进失败。' }
        }
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
		registerAccount: (username, userId, email, password) => {
			if (!username.trim() || !userId.trim() || !email.trim() || !password.trim()) {
				return { success: false, message: '请完整填写用户名、用户 ID、邮箱和密码。' }
			}
			const normalizedEmail = email.trim().toLowerCase()
			const normalizedUserID = userId.trim().replace(/^@+/, '')
        set((state) => ({
          isAuthenticated: true,
          accountEmail: normalizedEmail,
          accountPassword: password,
          actors: state.actors.map((actor) =>
            actor.id === state.currentActorId
              ? {
                  ...actor,
					name: username.trim(),
					handle: `@${normalizedUserID}`,
                }
              : actor,
          ),
        }))
        return { success: true }
      },
      setAccessToken: (token) => set({ accessToken: token }),
      refreshWorkspace: async () => {
        const accessToken = get().accessToken
        if (!accessToken) return { success: false, message: '当前没有登录会话。' }
        const headers = { Authorization: `Bearer ${accessToken}` }
        try {
          const [profileResponse, projectResponse, smartContractResponse] = await Promise.all([
            fetch('/api/users/me', { headers }),
            fetch('/api/projects', { headers }),
            fetch('/api/smart-contracts', { headers }),
          ])
          const profileData = (await profileResponse.json().catch(() => ({}))) as { user?: { id?: number; username?: string; userId?: string; bio?: string; gender?: Gender; avatarUrl?: string; profileBackgroundUrl?: string; customProfileEnabled?: boolean; customProfileMarkdown?: string } }
          const projectData = (await projectResponse.json().catch(() => ({}))) as { projects?: Project[] }
          const smartContractData = (await smartContractResponse.json().catch(() => ({}))) as { smartContracts?: SmartContractDefinition[] }
          if (!profileResponse.ok || !projectResponse.ok || !smartContractResponse.ok || !profileData.user?.id || !projectData.projects || !smartContractData.smartContracts) {
            throw new Error('读取账户工作区失败。')
          }
          const snapshots = await Promise.all(
            projectData.projects.map((project) => requestProjectState(accessToken, `/api/projects/${project.id}/graph`)),
          )
          const profileUser = profileData.user
          const actorId = String(profileUser.id)
          const actor: Actor = {
            id: actorId,
            name: profileUser.username ?? profileUser.userId ?? '未命名用户',
            handle: `@${profileUser.userId ?? actorId}`,
            role: '成员',
            bio: profileUser.bio ?? '',
            gender: profileUser.gender ?? 'undisclosed',
            avatarUrl: profileUser.avatarUrl,
            profileBackgroundUrl: profileUser.profileBackgroundUrl,
            customProfileEnabled: profileUser.customProfileEnabled,
            customProfileMarkdown: profileUser.customProfileMarkdown,
          }
          set({
            currentActorId: actorId,
            actors: [actor],
            projects: projectData.projects.map(normalizeProject),
            smartContracts: smartContractData.smartContracts,
            contracts: snapshots.flatMap((snapshot) => snapshot.nodes.map(normalizeExecutionContract)),
            branches: snapshots.flatMap((snapshot) => snapshot.branches),
            completionRecords: snapshots.flatMap((snapshot) => snapshot.completionRecords),
            edges: snapshots.flatMap((snapshot) => snapshot.edges),
          })
          return { success: true }
        } catch (error) {
          set({ actors: [], currentActorId: '', projects: [], smartContracts: [], branches: [], contracts: [], completionRecords: [], edges: [] })
          return { success: false, message: error instanceof Error ? error.message : '读取账户工作区失败。' }
        }
      },
      signOut: () => set({ isAuthenticated: false, accessToken: '', accountEmail: '', accountPassword: '', actors: [], currentActorId: '', projects: [], smartContracts: [], branches: [], contracts: [], completionRecords: [], edges: [] }),
      updateProfile: (input) => {
		const normalizedUserID = input.userId.trim().replace(/^@+/, '')
        set((state) => ({
          actors: state.actors.map((actor) =>
            actor.id === state.currentActorId
              ? {
                  ...actor,
					name: input.username.trim(),
					handle: `@${normalizedUserID}`,
                  bio: input.bio.trim(),
                  gender: input.gender,
                  avatarUrl: input.avatarUrl ?? actor.avatarUrl,
                  profileBackgroundUrl: input.profileBackgroundUrl ?? actor.profileBackgroundUrl,
                  customProfileEnabled: input.customProfileEnabled,
                  customProfileMarkdown: input.customProfileMarkdown,
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
      version: 18,
      migrate: (persistedState) => mergeSeedData(persistedState as LegacyState),
    },
  ),
)
