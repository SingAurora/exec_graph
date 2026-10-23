/** 浏览器 IndexedDB 中的一份未发布草稿；version 是存储格式版本，不是业务节点版本。 */
export type LocalDraftRecord = { version: 1; value: unknown; updatedAt: string }

let database: Promise<IDBDatabase> | undefined

// 复用数据库连接；升级时关闭旧连接，下次访问重新打开。
function openDatabase(): Promise<IDBDatabase> {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('exact.local-drafts', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('drafts')
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined }
        resolve(request.result)
      }
      request.onerror = () => { database = undefined; reject(request.error) }
    })
  }
  return database
}

/** 按隔离键读取本地草稿，调用方仍需校验格式；读取结果不是已发布行动。 */
export async function readLocalDraft(key: string): Promise<LocalDraftRecord | undefined> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readonly')
    const request = transaction.objectStore('drafts').get(key)
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

/** 写入草稿，或在发布成功／明确丢弃后删除；等待事务完成才向调用方报告成功。 */
export async function writeLocalDraft(key: string, value: unknown, remove = false): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', 'readwrite')
    const store = transaction.objectStore('drafts')
    if (remove) store.delete(key)
    else store.put({ version: 1, value, updatedAt: new Date().toISOString() } satisfies LocalDraftRecord, key)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}
