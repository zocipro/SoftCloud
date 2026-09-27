<template>
  <aside
    id="themes-panel"
    class="theme-panel"
    :class="{ closed: !store.ui.themePanelOpen }"
    :aria-hidden="!store.ui.themePanelOpen"
    :inert="!store.ui.themePanelOpen"
  >
    <div class="tp-inner">
      <div class="panel-head">
        <h2>主题库 <span class="panel-count">{{ themes.length }} 套</span></h2>
        <button class="panel-x" type="button" title="收起主题库" @click="store.ui.themePanelOpen = false">
          <Icon name="x" :size="13" aria-hidden="true" />
        </button>
      </div>

      <div class="tp-search">
        <Icon name="search" :size="13" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="搜索主题 / 关键词" aria-label="搜索主题" />
      </div>

      <div class="tp-tabs" role="tablist">
        <button
          v-for="c in categoryOrder"
          :key="c"
          class="tp-tab"
          :class="{ active: tab === c }"
          type="button"
          @click="tab = c"
        >
          {{ c }}
        </button>
      </div>

      <div class="tp-list">
        <div
          v-for="t in visibleThemes"
          :key="t.id"
          class="tp-card"
          :class="{ active: t.id === store.themeId }"
          role="button"
          tabindex="0"
          :aria-pressed="t.id === store.themeId"
          @mouseenter="store.previewThemeId = t.id"
          @mouseleave="store.previewThemeId = null"
          @click="pick(t)"
          @keydown.enter.prevent="pick(t)"
          @keydown.space.prevent="pick(t)"
        >
          <div class="tp-thumb" :style="{ background: t.surface || '#ffffff' }">
            <div class="tp-thumb-content" v-html="previewHtml[t.id]"></div>
          </div>
          <div class="tp-meta">
            <div class="tp-meta-text">
              <div class="tp-name">{{ t.name }}</div>
              <div class="tp-tag">{{ t.tag }}</div>
            </div>
            <button
              class="tp-star"
              :class="{ fav: favSet.has(t.id) }"
              type="button"
              :title="favSet.has(t.id) ? '取消收藏' : '收藏置顶'"
              @click.stop="toggleFav(t.id)"
            >
              {{ favSet.has(t.id) ? '★' : '☆' }}
            </button>
          </div>
        </div>
        <div v-if="!visibleThemes.length" class="tp-empty">没有匹配的主题</div>
      </div>

      <div class="tp-accent">
        <h4>主题色自定义（仅「{{ theme.name }}」）</h4>
        <div class="tp-colors">
          <button
            v-for="c in presets"
            :key="c"
            class="tp-color"
            :class="{ active: activeAccent === c }"
            :style="{ backgroundColor: c }"
            :title="c"
            type="button"
            @click="setActiveAccent(c)"
          ></button>
          <label class="tp-color custom" title="自定义颜色">
            <input
              type="color"
              :value="activeAccent || theme.primary"
              @input="setActiveAccent($event.target.value)"
            />
          </label>
          <button v-if="activeAccent" class="tp-reset" type="button" @click="setActiveAccent(null)">重置</button>
        </div>
        <div v-for="s in slots" :key="s.key" class="tp-slot">
          <span class="tp-slot-label">{{ s.label }}</span>
          <label
            class="tp-slot-picker"
            :style="{ backgroundColor: slotColors[s.key] || s.base }"
            :title="'调整' + s.label"
          >
            <input
              type="color"
              :value="slotColors[s.key] || s.base"
              @input="setSlotColor(s.key, $event.target.value)"
            />
          </label>
          <button v-if="slotColors[s.key]" class="tp-reset" type="button" @click="setSlotColor(s.key, null)">重置</button>
        </div>
        <div class="tp-accent-hint">改一个色，整套配色联动换算</div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { themes, themeCategories, categoryOrder, COLOR_SLOTS } from '../lib/themes.js'
import { renderMarkdown } from '../lib/renderer.js'
import { store, theme, activeAccent, setActiveAccent, activeSlotColors, setSlotColor, notify } from '../lib/store.js'

const query = ref('')
const tab = ref('全部')

const previewSource = `# 把复杂内容讲清楚

## 01 从一段真实内容开始

好的内容，也需要 **清楚的层次** 与 ==恰到好处的强调==。

> 让排版服务阅读，而不是抢走注意力。`

// 卡片实时缩略预览：固定参数渲染一次
const previewHtml = computed(() =>
  Object.fromEntries(
    themes.map((item) => [
      item.id,
      renderMarkdown(previewSource, item, {
        fontSize: 15,
        fontFamily: 'theme',
        accent: null,
        macCode: false,
        custom: {},
      }),
    ])
  )
)

const favSet = computed(() => new Set(store.settings.favoriteThemes || []))

// 当前主题的辅色槽位与已选辅色（无槽位的主题不显示辅色行）
const slots = computed(() => COLOR_SLOTS[theme.value.id] || [])
const slotColors = activeSlotColors

const visibleThemes = computed(() => {
  // 收藏优先置顶，再按 Tab 与关键词过滤
  let list = [...themes].sort((a, b) => Number(favSet.value.has(b.id)) - Number(favSet.value.has(a.id)))
  if (tab.value === '收藏') list = list.filter((t) => favSet.value.has(t.id))
  else if (tab.value !== '全部') list = list.filter((t) => (themeCategories[t.id] || '其他') === tab.value)

  const q = query.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((t) =>
    [t.name, t.tag, t.description, themeCategories[t.id]]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

const presets = ['#3eaf7c', '#2f6b4f', '#1e6fff', '#7e5aa2', '#eb2f96', '#e8830c', '#d43d33', '#0f766e', '#6f4e37', '#262626']

function pick(t) {
  store.themeId = t.id
  // 选中即退出“试看”态，避免与正式主题不一致
  store.previewThemeId = null
}

// 面板收起时清掉悬停残留的试看主题（悬停中直接关闭面板的兜底）
watch(
  () => store.ui.themePanelOpen,
  (open) => {
    if (!open) store.previewThemeId = null
  }
)

function toggleFav(id) {
  const favs = new Set(store.settings.favoriteThemes || [])
  if (favs.has(id)) favs.delete(id)
  else favs.add(id)
  store.settings.favoriteThemes = [...favs]
  notify(favs.has(id) ? `已收藏「${themes.find((t) => t.id === id)?.name}」` : '已取消收藏')
}
</script>
