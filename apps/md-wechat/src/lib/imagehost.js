// 图床供应商：可选的图片/视频公网托管。
// 每个供应商实现一个 upload(blob, config, filename) → 公网 URL。
// 凭据只存用户本机浏览器，不经过任何第三方中转。

// 从响应 JSON 里按 "a.b.c" 路径取值
export function extractUrl(data, path) {
  let value = data
  for (const key of String(path || 'url').split('.')) value = value?.[key]
  return typeof value === 'string' && value.startsWith('http') ? value : null
}

// Blob → base64（不带 data: 前缀）。用 FileReader 而不是逐字节拼接，
// 大文件（视频）也能高效转换，不会把页面卡死。
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export const IMAGE_HOSTS = [
  {
    id: 'smms',
    name: 'SM.MS',
    fields: [{ key: 'token', label: 'Token', secret: true, placeholder: 'SM.MS 的 API Token' }],
    async upload(blob, config, filename) {
      const form = new FormData()
      form.append('smfile', blob, filename)
      const res = await fetch('https://smms.app/api/v2/upload', {
        method: 'POST',
        headers: { Authorization: config.token },
        body: form,
      })
      const data = await res.json()
      if (data.success) return data.data.url
      if (data.code === 'image_repeated' && data.images) return data.images
      throw new Error(data.message || 'SM.MS 上传失败')
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    fields: [
      { key: 'repo', label: '仓库', placeholder: '如 laogou717/imgs' },
      { key: 'token', label: 'Token', secret: true, placeholder: '含 repo 权限的 Personal Access Token' },
      { key: 'branch', label: '分支（可选）', placeholder: '默认 main' },
      {
        key: 'pathMode',
        label: '上传路径',
        type: 'select',
        options: [
          { value: 'date', name: '按年月日（2026/08/07）' },
          { value: 'custom', name: '自定义路径' },
        ],
      },
      {
        key: 'customPath',
        label: '自定义路径',
        placeholder: '如 blog/images 或 2026/08',
        dependsOn: 'pathMode',
        dependsValue: 'custom',
      },
      { key: 'cdn', label: '开启 CDN 加速（fastly.jsdelivr.net）', type: 'checkbox' },
    ],
    async upload(blob, config, filename) {
      if (!config.repo || !config.token) throw new Error('未填写仓库或 Token')
      // GitHub Contents API 单文件上限 100MB；超大文件先拦截，避免白传
      if (blob.size > 100 * 1024 * 1024) throw new Error('GitHub 仓库单文件上限 100MB，请压缩后再上传')
      const branch = config.branch || 'main'
      // 默认按 年/月/日 分文件夹；切到自定义路径时用用户填写的目录（清理首尾斜杠）
      const d = new Date()
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dateDir = `${yyyy}/${mm}/${dd}`
      const customDir = String(config.customPath || '').trim().replace(/^\/+|\/+$/g, '')
      const dir = config.pathMode === 'custom' && customDir ? customDir : dateDir
      // 文件名保留时间戳前缀，避免同一天/同目录重名覆盖
      const path = `${dir}/${Date.now()}-${filename}`
      const content = await blobToBase64(blob)
      // commit 信息带上本次上传文件的 GitHub 链接（随 repo/分支/路径动态生成，不写死）
      const fileUrl = `https://github.com/${config.repo}/blob/${branch}/${path}`
      const res = await fetch(`https://api.github.com/repos/${config.repo}/contents/${path}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Upload by ${fileUrl}`, content, branch }),
      })
      if (!res.ok) throw new Error(`GitHub 返回 HTTP ${res.status}`)
      // 开启 CDN 加速时走 fastly.jsdelivr.net，否则用默认 cdn.jsdelivr.net
      const base = config.cdn ? 'https://fastly.jsdelivr.net/gh' : 'https://cdn.jsdelivr.net/gh'
      return `${base}/${config.repo}@${branch}/${path}`
    },
  },
  {
    id: 'custom',
    name: '自定义接口',
    fields: [
      { key: 'endpoint', label: '接口地址', placeholder: 'https://example.com/api/upload' },
      { key: 'token', label: 'Token（可选）', secret: true, placeholder: 'Bearer Token，可留空' },
      { key: 'field', label: '文件字段名', placeholder: '默认 file' },
      { key: 'urlPath', label: '返回 URL 字段', placeholder: '默认 url；嵌套写法如 data.url' },
    ],
    async upload(blob, config, filename) {
      if (!config.endpoint) throw new Error('未填写接口地址')
      const form = new FormData()
      form.append(config.field || 'file', blob, filename)
      const headers = {}
      if (config.token) {
        headers.Authorization = /^Bearer /i.test(config.token) ? config.token : `Bearer ${config.token}`
      }
      const res = await fetch(config.endpoint, { method: 'POST', headers, body: form })
      if (!res.ok) throw new Error(`接口返回 HTTP ${res.status}`)
      const url = extractUrl(await res.json(), config.urlPath || 'url')
      if (!url) throw new Error('响应中未找到图片 URL，请检查「返回 URL 字段」')
      return url
    },
  },
]

export function getImageHost(id) {
  return IMAGE_HOSTS.find((h) => h.id === id) || null
}
