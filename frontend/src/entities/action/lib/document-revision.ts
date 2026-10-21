import type { ActionDocumentRevision } from '../model/types'

/** Labels the latest manual operation, retaining the meaning of legacy supplement records. */
export function getDocumentRevisionLabel(revision: ActionDocumentRevision): string {
  return revision.kind === 'clear' ? '清空' : revision.kind === 'modify' ? '修改' : '补充'
}
