import { AgreementWorkspace } from '../../widgets/ai/AgreementWorkspace'
import { ActionWorkspace } from '../../widgets/ai/ActionWorkspace'
import { ExpressionWorkspace } from '../../widgets/ai/ExpressionWorkspace'
import { getActionDraftKey } from '../../entities/action/lib/draft-key'
import { getActionExpressionContext } from '../../entities/action/lib/expression-context'
import { getActionExpression } from '../../entities/action/lib/expressions'
import { getActionAgreement } from '../../entities/action/lib/agreements'
import type { ActionNode } from '../../entities/action/model/types'
import type { GenerationView } from '../../features/action-generation/api/generation'
import type { CreateActionInput } from '../../features/action/api/commands'
import type { Graph } from '../../entities/graph/model/types'
import type { AccountProfile } from '../../entities/profile/api/profiles'
import type { UserProfile } from '../../entities/profile/model/types'
import type { DraftScope } from '../../entities/draft/api/drafts'

type WorkspaceMode = 'action' | 'expression' | 'agreement'

type WorkspaceOutletProps = {
  mode: WorkspaceMode
  graph?: Graph
  parent?: ActionNode
  parentUuid?: string
  node?: ActionNode & { version: number }
  actions: ActionNode[]
  profile: AccountProfile
  users: UserProfile[]
  contextGuide?: string
  onBack: (graphUuid: string) => void
  onConfirmAction: (input: CreateActionInput) => Promise<boolean>
  onConfirmExpression: (input: NonNullable<GenerationView['updateExpression']>) => Promise<boolean>
  onConfirmAgreement: (input: NonNullable<GenerationView['updateAgreement']>) => Promise<boolean>
  onPublishExpressionDraft: () => Promise<boolean>
  onPublishAgreementDraft: () => Promise<boolean>
}

/** 发布页按 URL 中的模式选择三类工作区，避免 App 内继续嵌套三元。 */
export function WorkspaceOutlet({ mode, graph, parent, parentUuid, node, actions, profile, users, contextGuide, onBack, onConfirmAction, onConfirmExpression, onConfirmAgreement, onPublishExpressionDraft, onPublishAgreementDraft }: WorkspaceOutletProps) {
  const graphActions = graph ? actions.filter((item) => item.graphUuid === graph.uuid) : []

  if (mode === 'agreement') {
    if (!node) return <WorkspaceFallback />
    return (
      <AgreementWorkspace
        draftScope={{ type: 'agreement', graphUuid: node.graphUuid, nodeUuid: node.uuid } satisfies DraftScope}
        key={profile.uuid + ':agreement-' + node.uuid}
        node={node}
        actions={graphActions}
        profileName={profile.name} profileUuid={profile.uuid} profile={profile} users={users}
        contextGuide={contextGuide}
        onBack={() => onBack(node.graphUuid)} onConfirm={onConfirmAgreement} onPublishDraft={onPublishAgreementDraft}
      />
    )
  }

  if (mode === 'expression') {
    if (!node) return <WorkspaceFallback />
    return (
      <ExpressionWorkspace
        draftScope={{ type: 'expression', graphUuid: node.graphUuid, nodeUuid: node.uuid } satisfies DraftScope}
        key={profile.uuid + ':expression-' + node.uuid}
        node={node}
        actions={graphActions}
        profileName={profile.name} profileUuid={profile.uuid} profile={profile} users={users}
        contextGuide={contextGuide}
        onBack={() => onBack(node.graphUuid)} onConfirm={onConfirmExpression} onPublishDraft={onPublishExpressionDraft}
      />
    )
  }

  if (!graph || (parentUuid && !parent) || (!parent && actions.some((item) => item.graphUuid === graph.uuid))) {
    return <WorkspaceFallback />
  }

  return (
    <ActionWorkspace
      graphUuid={graph.uuid}
      key={getActionDraftKey(profile.uuid, graph.uuid, 'action', parent?.uuid)}
      draftScope={{ type: 'action', graphUuid: graph.uuid, parentUuid: parent?.uuid } satisfies DraftScope}
      profileName={profile.name} profile={profile} hasParent={Boolean(parent)}
      contextTitle={parent?.title} sourceNodeUuid={parent?.uuid}
      sourceNodeNumber={parent?.number}
      actions={graphActions}
      inheritedExpression={parent ? getActionExpression(actions, parent.uuid).markdown : ''}
      inheritedExpressionImages={parent ? getActionExpression(actions, parent.uuid).sourceNode?.images : []}
      historyFacts={parent ? getActionExpressionContext(actions, parent.uuid)?.facts : []}
      inheritedAgreement={parent && parent.authorUuid !== profile.uuid ? getActionAgreement(actions, parent.uuid).markdown : ''}
      contextGuide={contextGuide}
      onBack={() => onBack(graph.uuid)} onConfirm={onConfirmAction}
    />
  )
}

function WorkspaceFallback() {
  return (
    <div className="empty-state">
      <p>请先选择行动图和接续节点</p>
      <a className="quiet-button" href="#graphs">浏览行动图</a>
    </div>
  )
}
