<template>
  <header class="topbar">
    <a href="/#tools" class="sc-editor-brand" aria-label="SoftCloud 工具首页"><img :src="'/assets/brand-icon.png'" alt=""><span>softcloud</span></a>
    <div class="tb-name">软云排版</div>
    <div class="tb-tag">公众号 Markdown 编辑器</div>

    <div class="tb-save" :title="store.lastSavedAt ? '所有文章都会自动保存到「我的文章」' : '编辑后自动保存'">
      <i></i>{{ saveText }}
    </div>

    <div class="spacer"></div>

    <div class="tb-help">
      <button
        class="tb-help-btn"
        type="button"
        :class="{ open: helpOpen }"
        title="操作提示与快捷键"
        aria-label="操作提示与快捷键"
        aria-expanded="helpOpen"
        @click="helpOpen = !helpOpen"
      >
        <Icon name="question" :size="16" aria-hidden="true" />
      </button>
      <div v-if="helpOpen" class="tb-help-pop" @click.stop>
        <div class="help-k" v-for="row in helpRows" :key="row.k">
          <b>{{ row.k }}</b>
          <span>{{ row.d }}</span>
        </div>
        <div class="help-tip">快捷键在 macOS 用 ⌘、Windows/Linux 用 Ctrl</div>
      </div>
    </div>

    <nav class="tb-social" aria-label="相关链接">
      <a href="/#tools" title="返回工具首页">全部工具</a>
      <a href="https://github.com/laogou717/md-wechat" target="_blank" rel="noopener noreferrer" title="基于 md-wechat 开源构建"><Icon name="github" :size="16" aria-hidden="true" /></a>
    </nav>
  </header>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from './Icon.vue'
import { store } from '../lib/store.js'

const saveText = computed(() => {
  if (!store.lastSavedAt) return '本地自动保存已开启'
  const d = new Date(store.lastSavedAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `本地自动保存成功 ${hh}:${mm}:${ss}`
})

// ---- 操作提示浮层 ----
const helpOpen = ref(false)
const helpRows = [
  { k: '⌘⇧C / Ctrl⇧C', d: '一键复制排版，去公众号后台粘贴' },
  { k: '⌘S / Ctrl+S', d: '保存（平时每 250ms 自动保存）' },
  { k: '粘贴 / 拖入', d: '插入本地图片与视频' },
  { k: '图片拖拽', d: '拼贴中拖动两格边界微调宽度，双击恢复自动对齐' },
  { k: '点击预览段落', d: '回到对照模式并定位到对应源码行' },
  { k: '主题卡片悬停', d: '实时试看主题，点击确认切换' },
]
function closeHelpOnOutside(event) {
  if (!helpOpen.value) return
  if (event.target instanceof Element && event.target.closest('.tb-help')) return
  helpOpen.value = false
}
onMounted(() => document.addEventListener('pointerdown', closeHelpOnOutside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeHelpOnOutside, true))
</script>

<style scoped>
.tb-help {
  position: relative;
  margin-right: 4px;
}

.tb-help-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--ink-2, #6b6b72);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.tb-help-btn:hover,
.tb-help-btn.open {
  color: var(--ink, #18181b);
  background: var(--line-2, #f1ede1);
}

.tb-help-pop {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  width: 320px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--line-2, #e8e2d2);
  border-radius: 12px;
  box-shadow: 0 14px 40px rgba(12, 19, 15, 0.14);
  text-align: left;
}

.help-k {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 6px 4px;
  font-size: 13px;
}

.help-k b {
  flex: 0 0 92px;
  font-weight: 600;
  color: var(--ink, #18181b);
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
}

.help-k span {
  color: var(--ink-2, #6b6b72);
  line-height: 1.5;
}

.help-tip {
  margin-top: 8px;
  padding: 8px 4px 2px;
  border-top: 1px solid var(--line-2, #eee9dc);
  font-size: 12px;
  color: #9a948a;
}

.tb-social {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tb-social a {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  color: var(--ink-2, #6b6b72);
  border-radius: 8px;
  transition: background 0.12s ease, color 0.12s ease;
}

.tb-social a:hover {
  color: var(--ink, #18181b);
  background: var(--line-2, #f1ede1);
}
</style>
