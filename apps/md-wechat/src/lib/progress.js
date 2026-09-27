// 顶部进度条（nprogress 风格）：上传等不确定耗时的操作期间显示。
// 上传没有真实进度事件（fetch 不提供），所以用 trickle 动画渐进逼近 95%，
// 结束时一次性补满再淡出。支持并发：start/done 按引用计数配对，
// 所有上传都完成才真正收尾，不会提前消失。

let el = null
let timer = null
let counter = 0
let value = 0
let doneTimer = null

const TRICKLE_MS = 280 // 每次推进的间隔
const BAR_HEIGHT = 3 // 与 CSS 中 .app-progress 的 height 保持一致

function ensureEl() {
  if (el) return el
  el = document.createElement('div')
  el.className = 'app-progress'
  el.setAttribute('aria-hidden', 'true')
  const bar = document.createElement('div')
  bar.className = 'app-progress-bar'
  el.appendChild(bar)
  document.body.appendChild(el)
  return el
}

function setValue(v) {
  value = Math.min(100, Math.max(0, v))
  ensureEl().querySelector('.app-progress-bar').style.width = `${value}%`
}

export function startProgress() {
  counter += 1
  const root = ensureEl()
  root.classList.add('on')
  if (timer) return
  // 渐进逼近：起步快、越往后越慢，永远不到 100%（nprogress 同款手感）
  setValue(0)
  timer = setInterval(() => {
    const next = value + (100 - value) * 0.09 + 0.4
    setValue(next > 95 ? 95 : next)
  }, TRICKLE_MS)
}

export function doneProgress() {
  counter = Math.max(0, counter - 1)
  if (counter > 0) return
  clearInterval(timer)
  timer = null
  if (doneTimer) clearTimeout(doneTimer)
  // 补满 → 短暂停留 → 淡出 → 复位
  setValue(100)
  doneTimer = setTimeout(() => {
    ensureEl().classList.remove('on')
    doneTimer = setTimeout(() => setValue(0), 260)
  }, 180)
}
