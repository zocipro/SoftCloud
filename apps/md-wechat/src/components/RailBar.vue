<template>
  <nav class="rail" aria-label="功能栏">
    <button
      class="rail-btn"
      :class="{ active: store.ui.drawerOpen && store.ui.documentView === 'documents' }"
      type="button"
      title="我的文档"
      aria-label="我的文档"
      aria-controls="documents-panel"
      :aria-expanded="store.ui.drawerOpen && store.ui.documentView === 'documents'"
      @click="openDocumentView('documents')"
    >
      <Icon name="file-text" :size="18" aria-hidden="true" />
      <span v-if="store.docs.length" class="badge">{{ store.docs.length }}</span>
    </button>
    <button
      class="rail-btn"
      :class="{ active: store.ui.themePanelOpen }"
      type="button"
      title="主题库"
      aria-label="主题库"
      aria-controls="themes-panel"
      :aria-expanded="store.ui.themePanelOpen"
      @click="toggle('themePanelOpen')"
    >
      <Icon name="palette" :size="18" aria-hidden="true" />
    </button>
    <div class="rail-div"></div>
    <button
      class="rail-btn"
      :class="{ active: store.ui.drawerOpen && store.ui.documentView === 'trash' }"
      type="button"
      :title="`回收站${store.trash.length ? `（${store.trash.length}）` : ''}`"
      aria-label="回收站"
      aria-controls="documents-panel"
      :aria-expanded="store.ui.drawerOpen && store.ui.documentView === 'trash'"
      @click="openDocumentView('trash')"
    >
      <Icon name="trash" :size="18" aria-hidden="true" />
      <span v-if="store.trash.length" class="badge">{{ store.trash.length }}</span>
    </button>
  </nav>
</template>

<script setup>
import Icon from './Icon.vue'
import { store } from '../lib/store.js'

function toggle(key) {
  store.ui[key] = !store.ui[key]
}

function openDocumentView(view) {
  if (store.ui.drawerOpen && store.ui.documentView === view) {
    store.ui.drawerOpen = false
    return
  }
  store.ui.documentView = view
  store.ui.drawerOpen = true
}
</script>
