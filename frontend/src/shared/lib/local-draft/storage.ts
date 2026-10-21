/** One versioned, unpublished document saved in this browser. */
export type LocalDraftRecord = { version: 1; value: unknown; updatedAt: string }

let database: Promise<IDBDatabase> | undefined

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

/** Reads a draft without treating its contents as a published node. */
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

/** Commits a draft or removes it after an explicit save or discard. */
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
