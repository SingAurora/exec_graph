import type { ActionNode } from '../../../entities/action/model/types'
import type { Project } from '../../../entities/project/model/types'
import { interestImages } from './images'
import { interestScenarios } from './records'

/** 五个兴趣各固定选择自己的第三次行动，后续发布不会偷偷移动精选。 */
export const interestHighlightNodeIds = interestScenarios.map((scenario) => `${scenario.id}-3`)

/** 兴趣图由应用层注入，进入精选后仍可打开完整行动和来源。 */
export const interestProjects: Project[] = interestScenarios.map((scenario) => ({
  id: scenario.id,
  ownerId: 'jo',
  participantIds: [...new Set(scenario.records.map((record) => record.authorId).filter((id) => id !== 'jo'))],
  title: scenario.title,
  description: scenario.description,
  avatar: interestImages[scenario.id].url,
  backgroundImage: interestImages[scenario.id].url,
  createdAt: scenario.records[0].createdAt,
  updatedAt: scenario.records[2].createdAt,
}))

/** 每条引用都核对直接来源约定；最后一条行动继承对方的约定并更新自己的表达。 */
export const interestActions: ActionNode[] = interestScenarios.flatMap((scenario) => scenario.records.map((record, index) => {
  const id = `${scenario.id}-${index + 1}`
  const parentId = index > 0 ? `${scenario.id}-${index}` : undefined
  return {
    ...record,
    id,
    projectId: scenario.id,
    number: index + 1,
    parentId,
    objectiveMarkdown: record.markdown,
    referenceAgreements: parentId ? [{ sourceId: parentId, complies: true }] : [],
    images: index === 2 ? [interestImages[scenario.id]] : [],
    contextSnapshot: { directNodeIds: parentId ? [parentId] : [], historyNodeCount: index },
    conversation: [
      { id: `${id}-user`, speaker: 'user', body: `${record.markdown}\n\n我想留下的表达：\n${record.expressionMarkdown}\n\n${record.agreementMarkdown === undefined ? '后续约定沿用承接来源，不另写一份。' : `后续约定：\n${record.agreementMarkdown}`}${parentId ? '\n本次引用已按直接来源的约定核对，记录为满足。' : ''}` },
      { id: `${id}-ai`, speaker: 'ai', body: `行动保留你提供的具体经历，表达按你的取舍整理，不扩大成普遍结论。${record.agreementMarkdown === undefined ? '后续约定沿承接来源继承。' : '后续约定使用你这次提供的版本。'}${parentId ? '本次对来源约定的核对与向后传递的约定分别保留。' : ''}` },
    ],
  }
}))
