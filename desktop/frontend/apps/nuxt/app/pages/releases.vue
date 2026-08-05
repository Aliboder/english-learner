<script setup lang="ts">
import { BasePage } from '@english-learner/base'
import { APP_NAME, APP_VERSION } from '@english-learner/core/config/env'
import { RELEASE_NOTES, type ReleaseFeatureType } from '@english-learner/core/config/releaseNotes'
import { useReleaseNotification } from '@english-learner/core/composables/useReleaseNotification'
import { onMounted } from 'vue'
import Header from '@english-learner/core/components/Header.vue'

const { t } = useI18n()
const { markReleaseSeen } = useReleaseNotification()

const featureTypeClass: Record<ReleaseFeatureType, string> = {
  new: 'bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200',
  improve: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200',
  fix: 'bg-gray-500/15 text-gray-600 dark:bg-gray-400/20 dark:text-gray-300',
}

const featureTypeLabel: Record<ReleaseFeatureType, string> = {
  new: '新功能',
  improve: '优化',
  fix: '修复',
}

useSeoMeta({
  title: APP_NAME + ' — ' + '功能更新',
  description: '功能更新',
  ogTitle: APP_NAME + ' — ' + '功能更新',
})

onMounted(() => {
  markReleaseSeen()
})
</script>

<template>
  <BasePage>
    <Header title="功能更新" />
     
    <div class="space-y-5">
      <div
        v-for="release in RELEASE_NOTES"
        :key="release.version"
        class="card overflow-hidden"
        :class="
          release.version === APP_VERSION.version && 'ring-2 ring-violet-400/50 dark:ring-violet-500/40 shadow-md'
        "
      >
        <!-- Hero header for current version -->
        <div
          class="px-5 py-4 rounded-md"
          :class="
            release.version === APP_VERSION.version
              ? 'bg-gradient-to-r from-violet-500/10 via-blue-500/8 to-indigo-500/10 dark:from-violet-900/40 dark:via-blue-900/20 dark:to-indigo-900/30'
              : 'border-b border-[var(--color-input-border)]'
          "
        >
          <div class="flex items-center gap-3 flex-wrap">
            <span
              class="inline-flex items-center px-2.5 py-1 rounded-lg font-700"
              :class="
                release.version === APP_VERSION.version
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              "
            >
              v{{ release.version }}
            </span>
            <span class="text-[var(--color-text-3)]">{{ release.date }}</span>
            <span
              v-if="release.version === APP_VERSION.version"
              class="inline-flex items-center px-2 py-0.5 rounded-md font-500 bg-violet-500/15 text-violet-600 dark:bg-violet-400/20 dark:text-violet-300"
            >
              {{ '当前版本' }}
            </span>
          </div>
          <h2 class="text-lg font-700 text-[var(--color-text)]">{{ release.title }}</h2>
          <div class="text-[var(--color-text-2)]">{{ release.summary }}</div>
        </div>

        <!-- Feature list -->
        <div class="mt-2 pl-4">
          <div
            v-for="(feature, idx) in release.features"
            :key="idx"
            class="flex items-start gap-3 py-2"
            :class="idx < release.features.length - 1 && 'border-b border-[var(--color-input-border)]'"
          >
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-md font-500 shrink-0 mt-0.5"
              :class="featureTypeClass[feature.type]"
            >
              {{ featureTypeLabel[feature.type] }}
            </span>
            <div class="min-w-0">
              <div class="font-600 text-[var(--color-text)]">{{ feature.title }}</div>
              <div v-if="feature.desc" class="text-[var(--color-text-3)] mt-0.5">{{ feature.desc }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </BasePage>
</template>
