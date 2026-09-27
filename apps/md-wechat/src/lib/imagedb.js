// 图片库：粘贴的图片字节存 IndexedDB，文档里只留 local: 短引用。
// 渲染走内存 objectURL 缓存（渲染是同步的，IndexedDB 是异步的）；
// 复制到公众号前再把 local: 引用还原成 data URI。
const DB_NAME = 'md-wechat'
const STORE = 'images'
let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function putImage(id, blob) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getImage(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function allImageIds() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

// ---- objectURL 缓存：渲染器同步解析 local: 引用 ----
const objectUrls = new Map()

export function cacheImage(id, blob) {
  const old = objectUrls.get(id)
  if (old) URL.revokeObjectURL(old)
  objectUrls.set(id, URL.createObjectURL(blob))
}

export function getImageUrl(id) {
  return objectUrls.get(id) || null
}

// 缓存条目（id 与 objectURL 互查），复制时按 URL 反查图片用
export function getCachedImageEntries() {
  return [...objectUrls.entries()]
}

// 把指定 id 的媒体预热进内存缓存；不传则全量预热。
// 调用方应传当前仍被引用的 id（避免把历史遗留的大视频、孤儿图全部载入内存）。
export async function warmImageCache(ids) {
  try {
    const list = ids || (await allImageIds())
    for (const id of list) {
      if (!objectUrls.has(id)) {
        const blob = await getImage(id)
        if (blob) cacheImage(id, blob)
      }
    }
  } catch {
    // IndexedDB 不可用（如部分隐私模式）时静默降级，图片显示为占位
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// ---- 占用统计与清理 ----

export async function listImages() {
  const ids = await allImageIds()
  const items = []
  for (const id of ids) {
    const blob = await getImage(id)
    if (blob) items.push({ id, size: blob.size || 0 })
  }
  return items
}

export async function deleteImage(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => {
      const url = objectUrls.get(id)
      if (url) {
        URL.revokeObjectURL(url)
        objectUrls.delete(id)
      }
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

// 清理没有被任何文档引用的图片（孤儿），返回清理数量与释放字节数
export async function pruneImages(keepIds) {
  const keep = new Set(keepIds)
  const items = await listImages()
  let removed = 0
  let freed = 0
  for (const item of items) {
    if (!keep.has(item.id)) {
      await deleteImage(item.id)
      removed += 1
      freed += item.size
    }
  }
  return { removed, freed }
}
