<template>
  <div class="toolbar" role="toolbar" aria-label="Markdown 编辑工具">
    <div class="tb-group" role="group" aria-label="标题">
      <button class="tb-btn tb-text" type="button" title="二级标题" aria-label="插入二级标题" @mousedown.prevent @click="emit('cmd', 'h2')">
        H2
      </button>
      <button class="tb-btn tb-text" type="button" title="三级标题" aria-label="插入三级标题" @mousedown.prevent @click="emit('cmd', 'h3')">
        H3
      </button>
    </div>

    <span class="tb-div" role="separator" aria-orientation="vertical"></span>

    <div class="tb-group" role="group" aria-label="文字样式">
      <button class="tb-btn" type="button" title="加粗" aria-label="加粗文字" @mousedown.prevent @click="emit('cmd', 'bold')">
        <Icon name="bold" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="斜体" aria-label="设置斜体" @mousedown.prevent @click="emit('cmd', 'italic')">
        <Icon name="italic" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="删除线" aria-label="添加删除线" @mousedown.prevent @click="emit('cmd', 'strike')">
        <Icon name="strike" aria-hidden="true" />
      </button>
    </div>

    <span class="tb-div" role="separator" aria-orientation="vertical"></span>

    <div class="tb-group" role="group" aria-label="内容块">
      <button class="tb-btn" type="button" title="引用" aria-label="插入引用" @mousedown.prevent @click="emit('cmd', 'quote')">
        <Icon name="quote" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="行内代码" aria-label="插入行内代码" @mousedown.prevent @click="emit('cmd', 'inlineCode')">
        <Icon name="code" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="代码块" aria-label="插入代码块" @mousedown.prevent @click="emit('cmd', 'codeBlock')">
        <Icon name="file-code" aria-hidden="true" />
      </button>
    </div>

    <span class="tb-div" role="separator" aria-orientation="vertical"></span>

    <div class="tb-group" role="group" aria-label="插入内容">
      <button class="tb-btn" type="button" title="链接" aria-label="插入链接" @mousedown.prevent @click="emit('cmd', 'link')">
        <Icon name="link" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="插入本地图片（也可直接粘贴或拖入图片）" aria-label="插入本地图片" @mousedown.prevent @click="emit('cmd', 'image-file')">
        <Icon name="image" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="图库（连续多图自动拼图）" aria-label="插入图库" @mousedown.prevent @click="emit('cmd', 'gallery')">
        <Icon name="images" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="无序列表" aria-label="插入无序列表" @mousedown.prevent @click="emit('cmd', 'ul')">
        <Icon name="list" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="有序列表" aria-label="插入有序列表" @mousedown.prevent @click="emit('cmd', 'ol')">
        <Icon name="list-ol" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="表格" aria-label="插入表格" @mousedown.prevent @click="emit('cmd', 'table')">
        <Icon name="grid" aria-hidden="true" />
      </button>
      <button class="tb-btn" type="button" title="分割线" aria-label="插入分割线" @mousedown.prevent @click="emit('cmd', 'hr')">
        <Icon name="minus" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup>
import Icon from './Icon.vue'

const emit = defineEmits(['cmd'])
</script>
