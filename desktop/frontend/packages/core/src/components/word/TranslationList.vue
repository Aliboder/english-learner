<script setup lang="ts">
import { Word } from '../../types'
import { nextTick, onMounted, ref, watch } from 'vue'
import { playEdgeTts } from '../../hooks/sound.ts'
import { useSettingStore } from '../../stores/setting.ts'
import { simplifyTransCn } from '../../utils'
import { VolumeIcon } from '@typewords/base'

const props = withDefaults(
  defineProps<{
    word: Word
    showFull: boolean
    posSpace?: boolean // 词性是否需要固定占位
    showPlay?: boolean // 是否显示朗读按钮(练习页把按钮放在发音区,传 false;词表/查词等保持文档流按钮)
  }>(),
  {
    posSpace: true,
    showPlay: true,
  }
)

watch(
  () => props.word.trans,
  () => {
    init()
  }
)

/** 显示用释义:设置「显示详细翻译」关闭时移除括号补充内容(与朗读共用,保证缓存 key 一致) */
function displayCn(cn: string) {
  return settingStore.showDetailedTrans ? cn : simplifyTransCn(cn)
}

function init() {
  const trans = props.word.trans
  let posMap = new Map<string, { pos: string; cn: string; frequency?: number }[]>()
  let emptyPos: { cn: string; frequency?: number }[] = []
  trans.forEach(item => {
    const cn = displayCn(item.cn)
    if (!cn) return // 简化后为空(如纯括号条目)不显示
    const entry = { ...item, cn }
    if (!item.pos) {
      emptyPos.push(entry)
      return
    }
    if (!posMap.has(item.pos)) {
      posMap.set(item.pos, [])
    }
    posMap.get(item.pos)?.push(entry)
  })
  let list = Array.from(posMap, ([pos, trans]) => ({ pos: pos, trans: trans, totalFreq: 0 }))
  list.forEach(pos => {
    let totalFreq = 0
    pos.trans = pos.trans.sort((a, b) => b.frequency - a.frequency)
    pos.trans.forEach((tran, _) => {
      if (tran.frequency) {
        totalFreq += tran.frequency
      }
    })
    pos.totalFreq = totalFreq
  })
  list = list.sort((a, b) => b.totalFreq - a.totalFreq)
  posList = list
  noposTrans = emptyPos
}

let posList = $ref<{ pos: string; trans: { cn: string; frequency?: number }[]; totalFreq: number }[]>([])
let noposTrans = $ref<{ cn: string; frequency?: number }[]>([])

onMounted(() => {
  init()
})

// ---- 长翻译折叠(超 3 行折叠,点击展开全文) ----
// 折叠用 max-height + overflow:hidden(纯 block 行为,不用 -webkit-box,避免渲染怪癖)
const overflowKeys = ref<Set<string>>(new Set())
const expandedKeys = ref<Set<string>>(new Set())
const itemEls = ref<Record<string, HTMLElement | null>>({})

function itemKey(pos: string, index: number) {
  return `${pos}|${index}`
}

function checkOverflow() {
  nextTick(() => {
    const next = new Set<string>()
    for (const [key, el] of Object.entries(itemEls.value)) {
      if (el && el.scrollHeight > el.clientHeight + 4) next.add(key)
    }
    overflowKeys.value = next
  })
}

watch(
  () => posList,
  () => checkOverflow(),
  { deep: true }
)

function toggleExpand(key: string) {
  const set = new Set(expandedKeys.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  expandedKeys.value = set
}

const settingStore = useSettingStore()

// 「显示详细翻译」开关变化时重新生成展示列表
watch(
  () => settingStore.showDetailedTrans,
  () => {
    init()
  }
)

/** 有中文释义才显示朗读按钮(简化后为空的不算) */
const hasTrans = $computed(() => props.word.trans?.some(t => !!displayCn(t.cn)) ?? false)

/** 朗读中文翻译:拼接全部释义,微软 Edge TTS 在线合成(与显示同一份文本,缓存 key 一致) */
function playTranslationAudio() {
  const zh = props.word.trans
    ?.map(t => displayCn(t.cn))
    .filter(Boolean)
    // 顿号连接多释义,朗读更连贯(与 useWordPracticeAudio/preloadTts 一致,缓存 key 依赖它)
    .join('、')
  if (!zh) return
  playEdgeTts(zh, {
    volume: settingStore.wordSoundVolume / 100,
    engine: {
      lengthScale: settingStore.transSoundSpeed,
      voice: settingStore.ttsVoice,
    },
  })
}
</script>

<template>
  <div class="trans-list">
    <!-- 无词性翻译:词性位置留空占位,保持与分组条目缩进一致 -->
    <div v-for="(tran, i) in noposTrans" :key="'n' + i" class="trans-item">
      <span class="pos" :class="{ 'pos-col': posSpace }"></span>
      <span
        v-if="tran.frequency != undefined"
        :class="['rare', 'uncommon', 'common'][tran.frequency]"
        class="trans-text"
      >
        {{ tran.cn }}
      </span>
      <span v-else class="trans-text">{{ tran.cn }}</span>
    </div>

    <!-- 按词性分组,每行一条:词性 inline-block 固定宽,翻译行内文本,纯文档流绝无重叠 -->
    <div v-for="pos in posList" :key="pos.pos" class="pos-group">
      <div v-for="(tran, i) in pos.trans" :key="i" class="trans-item">
        <span class="pos" :class="{ 'pos-col': posSpace }">{{ pos.pos }}</span>
        <span
          :ref="el => (itemEls[itemKey(pos.pos, i)] = el as HTMLElement | null)"
          class="trans-text"
          :class="[
            tran.frequency != undefined ? ['rare', 'uncommon', 'common'][tran.frequency] : '',
            overflowKeys.has(itemKey(pos.pos, i)) ? 'clamp' : '',
            expandedKeys.has(itemKey(pos.pos, i)) ? 'clamp-expanded' : '',
          ]"
        >
          {{ tran.cn }}
        </span>
        <button
          v-if="overflowKeys.has(itemKey(pos.pos, i))"
          class="trans-toggle"
          @click="toggleExpand(itemKey(pos.pos, i))"
        >
          {{ expandedKeys.has(itemKey(pos.pos, i)) ? '收起' : '展开' }}
        </button>
      </div>
    </div>

    <!-- 翻译朗读按钮:文档流(练习页传 show-play=false 隐藏,由发音区按钮代替) -->
    <div v-if="hasTrans && props.showPlay" class="trans-actions">
      <VolumeIcon class="trans-play" title="朗读翻译(中文)" @click="playTranslationAudio()" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.trans-list {
  @apply flex flex-col gap-1;
}

.pos-group {
  @apply flex flex-col gap-1;
}

// 每条翻译一行:block 文档流,词性 inline-block 占位,翻译行内文本
.trans-item {
  display: block;
  line-height: 1.5;

  .pos {
    display: inline-block;
    color: var(--color-select-bg);
    vertical-align: top;
    margin-right: 0.4rem;
  }

  // 词性固定 3rem 占位,与 WordDetail 统一对齐规则
  .pos-col {
    min-width: 3rem;
  }


  .trans-text {
    display: inline;
    color: var(--color-main-text);
    word-break: break-word;
  }
}

// 长翻译折叠:max-height + overflow(纯 block 行为,不会与词性重叠)
.clamp {
  display: block;
  max-height: 4.6em; // 约 3 行
  overflow: hidden;
}

.clamp-expanded {
  max-height: none;
}

.trans-toggle {
  font-size: 0.7rem;
  color: var(--color-link);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  margin-left: 0.3rem;

  &:hover {
    opacity: 0.8;
  }
}

.rare {
  opacity: 0.6;
  font-weight: 100;
}

.uncommon {
  opacity: 0.8;
  font-weight: 300;
}

.common {
  opacity: 1;
  font-weight: 500;
}

.trans-actions {
  @apply mt-0.5 flex;

  .trans-play {
    @apply cursor-pointer;
    color: var(--color-sub-text);

    &:hover {
      color: var(--color-link);
    }
  }
}
</style>
