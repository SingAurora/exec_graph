export type SmartContractSource = 'official' | 'custom'

export type SmartContractDefinition = {
  uuid: string
  name: string
  source: SmartContractSource
  version: string
  description: string
  /** The single Markdown document that defines deployment and review behavior. */
  body: string
}
