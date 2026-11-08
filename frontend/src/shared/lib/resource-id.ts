/** 兼容显式服务端 alias；业务请求始终使用 UUID，不推算或硬编码演示 UUID。 */
export function resourceId(items: readonly { uuid: string; legacyId?: string }[], value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return items.find((item) => item.uuid === value || item.legacyId === value)?.uuid ?? value
}
