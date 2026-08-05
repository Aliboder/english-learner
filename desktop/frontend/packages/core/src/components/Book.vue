<script setup lang="ts">
import type { Dict } from '../types'
import { Checkbox, Progress } from '@typewords/base'
import { withAppBaseURL } from '../utils/base-url'

interface IProps {
  item?: Partial<Dict>
  quantifier?: string
  isAdd: boolean
  showCheckbox?: boolean
  checked?: boolean
  selected?: boolean
  showProgress?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  showProgress: true,
})

const emit = defineEmits<{
  check: []
  click: []
}>()

const progress = $computed(() => {
  return Number(((props.item?.lastLearnIndex / props.item?.length) * 100).toFixed())
})

const studyProgress = $computed(() => {
  if (!props.showProgress) return
  return props.item?.lastLearnIndex ? props.item?.lastLearnIndex + '/' : ''
})

const coverSrc = $computed(() => {
  return props.item?.cover ? withAppBaseURL(props.item.cover) : ''
})

function handleClick(e: MouseEvent) {
  if (props.showCheckbox) {
    e.stopPropagation()
    emit('check')
  } else {
    emit('click')
  }
}
</script>

<template>
  <div style="width: var(--book-width)" :id="`dict-${item?.id}`" v-if="!isAdd" @click="handleClick">
    <div
      class="book overflow-hidden relative"
      :class="[showCheckbox && 'book-selectable', (selected || checked) && 'book-selected']"
    >
      <img class="absolute top-0 left-0 w-full object-cover" v-if="item?.cover" :src="coverSrc" alt="" />
      <template v-else>
        <!-- 无封面词库:渐变封面条 + 名称 -->
        <div class="gradient-bar"></div>
        <div class="text-base mt-1 font-semibold">{{ item?.name }}</div>
      </template>
      <div class="absolute bottom-4 right-3 z-1" v-if="!item?.cover">
        <div>{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
      </div>
      <div class="absolute bottom-2 left-3 right-3">
        <Progress
          v-if="item?.lastLearnIndex && showProgress"
          class="mt-1"
          :percentage="progress"
          :show-text="false"
        ></Progress>
      </div>
      <Checkbox
        v-if="showCheckbox"
        :model-value="checked"
        @change="$emit('check')"
        class="absolute left-2 bottom-3 z-3"
      />
      <div class="custom z-1" v-if="item.custom">{{ '自定义' }}</div>
      <div class="system z-1" v-else-if="item.system">{{ '内置' }}</div>
      <!--      <div class="custom bg-red! color-white z-1" v-else-if="item.update">更新中</div>-->
    </div>
    <div class="flex justify-between text-base mt-1" v-if="item?.cover">
      <div class="w-6/10 truncate">{{ item?.name }}</div>
      <div>{{ studyProgress }}{{ item?.length }}{{ quantifier }}</div>
    </div>
  </div>
  <div v-else class="book" id="no-book" @click="handleClick">
    <div class="h-full center text-2xl">
      <IconFluentAdd16Regular />
    </div>
  </div>
</template>

<style scoped lang="scss">
// 无封面词库的渐变封面条
.gradient-bar {
  height: 0.5rem;
  border-radius: var(--radius-card, 14px) var(--radius-card, 14px) 0 0;
  background: var(--color-select-bg);
  margin: -0.75rem -0.75rem 0.5rem;
}

.book-selectable {
  &:hover {
    border-color: var(--color-input-border);
  }
}

.book-selected {
  @apply bg-fifth;
  border-color: var(--color-select-bg) !important;
}

.custom {
  position: absolute;
  top: 4px;
  right: -22px;
  padding: 1px 20px;
  background: var(--color-select-bg);
  color: white;
  font-size: 11px;
  transform: rotate(45deg);
}

.system {
  position: absolute;
  left: 10px;
  bottom: 18px;
  border-radius: 8px;
  padding: 2px 8px;
  background: var(--color-select-bg);
  color: white;
  font-size: 11px;
}

.sync {
  @extend .custom;
  bottom: 4px;
  left: -22px;
  top: unset;
  right: unset;
}
</style>