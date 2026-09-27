// 以富文本（text/html）形式复制，粘贴到公众号编辑器才能保留排版。
// 优先用现代 Clipboard API，失败时回退到 execCommand 方案。

export async function copyRichText(html) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([htmlToText(html)], { type: 'text/plain' }),
      }),
    ])
    return true
  } catch {
    return legacyCopy(html)
  }
}

function legacyCopy(html) {
  const div = document.createElement('div')
  div.contentEditable = 'true'
  div.style.cssText = 'position:fixed;left:-9999px;top:0;'
  div.innerHTML = html
  document.body.appendChild(div)
  const range = document.createRange()
  range.selectNodeContents(div)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  sel.removeAllRanges()
  document.body.removeChild(div)
  return ok
}

function htmlToText(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

// 复制纯文本（用于「复制 HTML 源码」）
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(ta)
    return ok
  }
}
