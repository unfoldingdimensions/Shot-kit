/**
 * The screenshot lives in IndexedDB, not localStorage.
 *
 * Styling is a few KB of JSON and fits localStorage fine. A screenshot is
 * megabytes and blows the ~5MB quota, which is why it used to be dropped on
 * reload — leaving a restored composition with a hole where the image was.
 * IndexedDB has no such limit.
 */
const DB_NAME = 'shotkit'
const STORE = 'session'
const KEY = 'screenshot'

export interface StoredImage {
  src: string
  w: number
  h: number
  name: string
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'))
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE)
    }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => db.close()
    }
  })
}

export const saveScreenshot = (img: StoredImage) =>
  withStore<void>('readwrite', (s) => s.put(img, KEY))

export const loadScreenshot = () =>
  withStore<StoredImage | undefined>('readonly', (s) => s.get(KEY))

export const clearScreenshot = () => withStore<void>('readwrite', (s) => s.delete(KEY))
