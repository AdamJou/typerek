<script setup lang="ts">
import type { ResolvedBonusStatisticOption } from '~/utils/statistics'

const props = defineProps<{
  option: ResolvedBonusStatisticOption
}>()

const imageFailed = shallowRef(false)
const barStyle = computed(() => ({
  '--statistics-bar-width': `${props.option.percentage}%`,
}))

const averagePositionLabel = computed(() =>
  props.option.averagePosition?.toLocaleString('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }) ?? '',
)
</script>

<template>
  <div
    class="statistics-row"
    :aria-label="`${option.label}: ${option.percentage}%, ${option.count} głosów`"
  >
    <div class="statistics-row-heading">
      <div class="statistics-option">
        <span v-if="option.flag" class="statistics-flag" aria-hidden="true">
          <img
            v-if="option.flag.src && !imageFailed"
            :src="option.flag.src"
            :alt="option.flag.alt"
            @error="imageFailed = true"
          >
          <span v-else>{{ option.flag.emoji }}</span>
        </span>
        <strong>{{ option.label }}</strong>
      </div>

      <div class="statistics-value">
        <strong>{{ option.percentage }}%</strong>
        <span>{{ option.count }} głosów</span>
        <span v-if="averagePositionLabel" class="average-position">
          śr. poz. {{ averagePositionLabel }}
        </span>
      </div>
    </div>

    <div class="statistics-track" aria-hidden="true">
      <span :style="barStyle" />
    </div>
  </div>
</template>

<style scoped>
.statistics-row {
  display: grid;
  gap: 8px;
}

.statistics-row-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.statistics-option,
.statistics-value {
  display: flex;
  min-width: 0;
  align-items: center;
}

.statistics-option {
  gap: 9px;
}

.statistics-option > strong {
  overflow: hidden;
  font-size: 14px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statistics-flag {
  display: inline-flex;
  width: 28px;
  height: 20px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(20, 33, 27, 0.1);
  border-radius: 3px;
  background: #f7f8f3;
  flex: 0 0 auto;
  font-size: 18px;
  line-height: 1;
}

.statistics-flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.statistics-value {
  flex: 0 0 auto;
  gap: 8px;
  white-space: nowrap;
}

.statistics-value strong {
  color: var(--app-primary-dark);
  font-size: 14px;
}

.statistics-value span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 800;
}

.statistics-value .average-position {
  border-left: 1px solid var(--app-line);
  padding-left: 8px;
  color: var(--app-primary-dark);
}

.statistics-track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9efe8;
}

.statistics-track span {
  display: block;
  width: var(--statistics-bar-width);
  min-width: 4px;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--app-primary), #2d936b);
}

@media (max-width: 520px) {
  .statistics-row-heading {
    align-items: start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
