<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import type { Word } from '../../types'
import { cancelTtsAudio, playEdgeTts, usePlayWordAudio } from '../../hooks/sound.ts'
import { useBaseStore } from '../../stores/base.ts'
import { useSettingStore } from '../../stores/setting.ts'
import { useWordOptions } from '../../hooks/dict.ts'
import { parseInflections } from '../../utils/inflections.ts'
import { simplifyTransCn } from '../../utils'
import { buildTransSpeechText } from '../../utils/transSpeech'
import { VolumeIcon } from '@english-learner/base'

const settingStore = useSettingStore()

// 关闭查词详情时停止正在朗读的翻译语音(组件卸载后 Audio 仍在播放)
onUnmounted(() => {
  cancelTtsAudio()
})

/** 展示用释义:设置「显示详细翻译」关闭时移除括号补充内容(与朗读共用,缓存 key 一致) */
function displayCn(cn: string) {
  return settingStore.showDetailedTrans ? cn : simplifyTransCn(cn)
}

/** 中文翻译朗读:拼接全部释义,微软 Edge TTS 在线合成(与练习页/预加载共用同一拼接,缓存 key 一致) */
function playTranslationAudio() {
  const zh = buildTransSpeechText(props.word.trans, settingStore.showDetailedTrans, settingStore.limitTransSpeech)
  if (!zh) return
  playEdgeTts(zh, {
    volume: settingStore.wordSoundVolume / 100,
    engine: {
      lengthScale: settingStore.transSoundSpeed,
      voice: settingStore.ttsVoice,
    },
  })
}

const props = withDefaults(
  defineProps<{
    word: Word
    /** 显示收藏按钮(查词场景用;词库详情预览不显示) */
    showActions?: boolean
    /** 三栏布局(主界面查词详情用;词典详情页等保持默认单栏) */
    threeCols?: boolean
  }>(),
  { showActions: false, threeCols: false }
)

const playWordAudio = usePlayWordAudio()
const base = useBaseStore()
const { isWordCollect, toggleWordCollect } = useWordOptions()

/** 个人笔记集中存在 noteData 里,不在 Word 对象内 */
const note = $computed(() => base.noteData[props.word.word])
const hasPhonetic = $computed(() => !!(props.word.phonetic0 || props.word.phonetic1))

const infList = computed(() => parseInflections(props.word.inflections))

/** 扩展信息块(顺序即展示顺序) */
const extBlocks = computed(() => {
  const list: { key: string; label: string }[] = []
  if (base.noteData[props.word.word]?.trim()) list.push({ key: 'note', label: '笔记' })
  if (infList.value.length) list.push({ key: 'inflections', label: '词形变化' })
  if (props.word.sentences?.length) list.push({ key: 'sentences', label: '例句' })
  if (props.word.phrases?.length) list.push({ key: 'phrases', label: '短语' })
  if (props.word.synos?.length) list.push({ key: 'synos', label: '近义词' })
  if (props.word.relWords?.root || props.word.relWords?.rels?.length) list.push({ key: 'relWords', label: '同根词' })
  if (props.word.etymology?.length) list.push({ key: 'etymology', label: '词源' })
  return list
})

/**
 * 动态栏数(避免"右栏消失"):扩展块 ≥3 三栏、1-2 块两栏、0 块单栏;
 * 三栏时按块数均分到中/右栏,保证各栏高度接近。
 */
const colsMode = computed(() => {
  if (!props.threeCols) return 1
  const n = extBlocks.value.length
  if (n >= 3) return 3
  if (n >= 1) return 2
  return 1
})

const midBlocks = computed(() => {
  if (colsMode.value !== 3) return []
  return extBlocks.value.slice(0, Math.ceil(extBlocks.value.length / 2))
})
const sideBlocks = computed(() => {
  if (colsMode.value === 3) return extBlocks.value.slice(Math.ceil(extBlocks.value.length / 2))
  return extBlocks.value
})

/** 三栏/两栏时的右侧栏容器列表 */
const cols = computed(() => {
  if (colsMode.value === 3) {
    return [
      { cls: 'col-mid', blocks: midBlocks.value },
      { cls: 'col-side', blocks: sideBlocks.value },
    ]
  }
  if (colsMode.value === 2) {
    return [{ cls: 'col-rest', blocks: sideBlocks.value }]
  }
  return []
})
</script>

<template>
  <div class="word-detail" :class="{ 'three-cols': props.threeCols }">
    <!-- 头部:单词 + 音标 + 发音 -->
    <div class="detail-head">
      <span class="detail-word">{{ word.word }}</span>
      <span v-if="hasPhonetic" class="detail-phonetic">{{ word.phonetic0 }} {{ word.phonetic1 }}</span>
      <VolumeIcon class="play-btn" @click="playWordAudio(word.word)"></VolumeIcon>
      <span v-if="showActions" class="collect-btn" @click="toggleWordCollect(word)">
        <IconFluentStar16Filled v-if="isWordCollect(word)" />
        <IconFluentStar16Regular v-else />
        {{ isWordCollect(word) ? '已收藏' : '收藏' }}
      </span>
    </div>

    <!-- 三栏/两栏(查词场景 three-cols):左翻译,右侧扩展按块数动态分栏(避免空栏) -->
    <div v-if="props.threeCols && cols.length" class="detail-body" :class="'cols-' + colsMode">
      <!-- 左栏:翻译 -->
      <div class="col-main">
        <section v-if="word.trans?.length" class="detail-section">
          <div class="detail-label detail-label-flex">
            <span>{{ '翻译' }}</span>
            <VolumeIcon class="trans-play" title="朗读翻译(中文)" @click="playTranslationAudio()" />
          </div>
          <div class="detail-content">
            <!-- 词性固定宽度对齐(与练习页翻译面板统一),长翻译完整显示 -->
            <p v-for="(t, i) in word.trans" :key="i" class="trans-line">
              <span class="pos" v-if="t.pos">{{ t.pos }}</span>
              <span class="trans-text" v-if="displayCn(t.cn)">{{ displayCn(t.cn) }}</span>
            </p>
          </div>
        </section>
      </div>

      <!-- 右侧栏(两栏=合并,三栏=中/右均分) -->
      <div v-for="col in cols" :key="col.cls" :class="col.cls">
        <section v-for="b in col.blocks" :key="b.key" class="detail-section">
          <div class="detail-label">{{ b.label }}</div>
          <div class="detail-content">
            <template v-if="b.key === 'note'">
              <div class="note">{{ base.noteData[word.word] }}</div>
            </template>
            <template v-else-if="b.key === 'inflections'">
              <div class="flex flex-wrap gap-x-4 gap-y-1">
                <p v-for="inf in infList" :key="inf.label">
                  <span class="pos">{{ inf.label }}</span>{{ inf.value }}
                </p>
              </div>
            </template>
            <template v-else-if="b.key === 'sentences'">
              <div v-for="(s, i) in word.sentences" :key="i" class="pair">
                <p class="en">{{ s.c }}</p>
                <p class="zh">{{ s.cn }}</p>
              </div>
            </template>
            <template v-else-if="b.key === 'phrases'">
              <div v-for="(p, i) in word.phrases" :key="i" class="pair">
                <p class="en">{{ p.c }}</p>
                <p class="zh">{{ p.cn }}</p>
              </div>
            </template>
            <template v-else-if="b.key === 'synos'">
              <div v-for="(s, i) in word.synos" :key="i" class="pair">
                <p><span class="pos" v-if="s.pos">{{ s.pos }}</span>{{ s.cn }}</p>
                <p v-if="s.ws?.length" class="zh">{{ s.ws.join(' / ') }}</p>
              </div>
            </template>
            <template v-else-if="b.key === 'relWords'">
              <p v-if="word.relWords.root" class="en">{{ '词根' }}：{{ word.relWords.root }}</p>
              <div v-for="(r, i) in word.relWords.rels" :key="i" class="pair">
                <p class="en">{{ r.pos }}</p>
                <p v-for="(w, j) in r.words" :key="j" class="zh">{{ w.c }}：{{ w.cn }}</p>
              </div>
            </template>
            <template v-else-if="b.key === 'etymology'">
              <div v-for="(e, i) in word.etymology" :key="i" class="pair">
                <p class="en">{{ e.t }}</p>
                <p class="zh">{{ e.d }}</p>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>

    <!-- 单栏(词典详情页等非三栏场景,或查词但无扩展信息):翻译 + 扩展块纵向 -->
    <template v-else>
      <!-- 翻译 -->
      <section v-if="word.trans?.length" class="detail-section">
        <div class="detail-label detail-label-flex">
          <span>{{ '翻译' }}</span>
          <VolumeIcon class="trans-play" title="朗读翻译(中文)" @click="playTranslationAudio()" />
        </div>
        <div class="detail-content">
          <p v-for="(t, i) in word.trans" :key="i" class="trans-line">
            <span class="pos" v-if="t.pos">{{ t.pos }}</span>
            <span class="trans-text" v-if="displayCn(t.cn)">{{ displayCn(t.cn) }}</span>
          </p>
        </div>
      </section>

      <!-- 扩展信息块 -->
      <section v-for="b in extBlocks" :key="b.key" class="detail-section">
        <div class="detail-label">{{ b.label }}</div>
        <div class="detail-content">
          <template v-if="b.key === 'note'">
            <div class="note">{{ base.noteData[word.word] }}</div>
          </template>
          <template v-else-if="b.key === 'inflections'">
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <p v-for="inf in infList" :key="inf.label">
                <span class="pos">{{ inf.label }}</span>{{ inf.value }}
              </p>
            </div>
          </template>
          <template v-else-if="b.key === 'sentences'">
            <div v-for="(s, i) in word.sentences" :key="i" class="pair">
              <p class="en">{{ s.c }}</p>
              <p class="zh">{{ s.cn }}</p>
            </div>
          </template>
          <template v-else-if="b.key === 'phrases'">
            <div v-for="(p, i) in word.phrases" :key="i" class="pair">
              <p class="en">{{ p.c }}</p>
              <p class="zh">{{ p.cn }}</p>
            </div>
          </template>
          <template v-else-if="b.key === 'synos'">
            <div v-for="(s, i) in word.synos" :key="i" class="pair">
              <p><span class="pos" v-if="s.pos">{{ s.pos }}</span>{{ s.cn }}</p>
              <p v-if="s.ws?.length" class="zh">{{ s.ws.join(' / ') }}</p>
            </div>
          </template>
          <template v-else-if="b.key === 'relWords'">
            <p v-if="word.relWords.root" class="en">词根：{{ word.relWords.root }}</p>
            <div v-for="(r, i) in word.relWords.rels" :key="i" class="pair">
              <p class="en">{{ r.pos }}</p>
              <p v-for="(w, j) in r.words" :key="j" class="zh">{{ w.c }}：{{ w.cn }}</p>
            </div>
          </template>
          <template v-else-if="b.key === 'etymology'">
            <div v-for="(e, i) in word.etymology" :key="i" class="pair">
              <p class="en">{{ e.t }}</p>
              <p class="zh">{{ e.d }}</p>
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.word-detail {
  @apply h-full overflow-auto;
  padding: 0.5rem 0.75rem 0.5rem 0;
}

// 多栏(仅查词场景 three-cols):栏数由扩展块数量决定(cols-3 三栏 / cols-2 两栏),栏间分隔线贯穿等高
.word-detail.three-cols {
  .detail-body {
    display: grid;
    gap: 0 1.25rem;

    &.cols-3 {
      grid-template-columns: repeat(3, 1fr);
    }

    &.cols-2 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .col-main,
  .col-mid,
  .col-side,
  .col-rest {
    min-width: 0;
  }

  .col-main {
    padding-right: 1.25rem;
    border-right: 1px solid var(--color-item-border);
  }

  .cols-3 .col-mid {
    padding-right: 1.25rem;
    border-right: 1px solid var(--color-item-border);
  }
}

.detail-head {
  @apply flex items-center gap-2 mb-3 pb-2 border-b;
  border-color: var(--color-item-border);

  .detail-word {
    @apply text-xl font-bold break-all;
  }

  .detail-phonetic {
    @apply text-gray;
  }

  .play-btn {
    @apply cursor-pointer color-link shrink-0;
  }

  .collect-btn {
    @apply cursor-pointer shrink-0 flex items-center gap-1 text-sm rounded-md px-2 py-1;
    color: var(--color-link);
    border: 1px solid var(--color-item-border);
    transition: all var(--anim-time);

    &:hover {
      background: var(--color-third);
    }
  }
}

.detail-section {
  @apply mb-4;
}

.detail-label {
  @apply text-lg font-bold mb-1.5 pl-2;
  color: var(--color-main-text);
  border-left: 3px solid var(--color-select-bg);
  line-height: 1.2;
}

.detail-label-flex {
  @apply flex items-center gap-2;
}

// 翻译朗读按钮(对齐例句喇叭样式)
.trans-play {
  @apply cursor-pointer shrink-0;
  color: var(--color-sub-text);

  &:hover {
    color: var(--color-link);
  }
}

.detail-content {
  @apply space-y-1 text-sm;
  color: var(--color-main-text);
}

.pair {
  @apply space-y-0.5;

  .en {
    color: var(--color-main-text);
  }

  .zh {
    color: var(--color-sub-text);
  }
}

// 翻译行:词性固定 3rem 宽对齐,释义完整显示
.trans-line {
  @apply flex items-start break-words;

  .pos {
    @apply text-xs shrink-0;
    color: var(--color-sub-text);
    min-width: 3rem;
    // 间距不依赖 flex gap(margin-right 兜底,防止 gap 失效时与释义紧贴/重叠)
    margin-right: 0.4rem;
  }

  .trans-text {
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }
}

.pos {
  @apply mr-1 text-xs;
  color: var(--color-sub-text);
}

.note {
  @apply whitespace-pre-wrap rounded p-2;
  background: var(--color-second);
}
</style>