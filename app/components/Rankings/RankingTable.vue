<script setup lang="ts">
import type { RankingRow } from '~/types/domain'

const props = defineProps<{
  rows: readonly RankingRow[]
  mode?: 'general' | 'stage'
}>()

const displayedRows = computed(() => {
  const bottomPositions = new Set([...new Set(props.rows.map((row) => row.position))].slice(-4))

  return props.rows.map((row) => {
    const isStageTop = props.mode === 'stage' && row.position <= 4
    const isStageBottom = props.mode === 'stage' && !isStageTop && bottomPositions.has(row.position)

    return {
      row,
      rowClass: {
        'stage-top': isStageTop,
        'stage-bottom': isStageBottom,
      },
    }
  })
})
</script>

<template>
  <div class="ranking-table panel">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Gracz</th>
          <th>Suma</th>
          <th>Wynik</th>
          <th>Dokł.</th>
          <th>Strz.</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ row, rowClass } in displayedRows"
          :key="row.userId"
          class="participant-row"
          :class="rowClass"
        >
          <td>{{ row.position }}</td>
          <td>
            <NuxtLink class="participant-row-link" :to="`/participants/${row.userId}`">
              {{ row.displayName }}
            </NuxtLink>
          </td>
          <td><strong class="total-points">{{ row.totalPoints }}</strong></td>
          <td>{{ row.outcomePoints }}</td>
          <td>{{ row.exactScorePoints }}</td>
          <td>{{ row.firstScorerPoints }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ranking-table {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid var(--app-line);
  padding: 13px 12px;
  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

td {
  font-size: 14px;
  font-weight: 700;
  transition: background-color 160ms ease;
}

.participant-row {
  position: relative;
  cursor: pointer;
}

.participant-row:hover td {
  background: #f4f8f4;
}

.participant-row.stage-top td {
  background: #edf8f0;
}

.participant-row.stage-top td:first-child {
  box-shadow: inset 4px 0 0 var(--app-primary);
  color: var(--app-primary-dark);
}

.participant-row.stage-top:hover td {
  background: #e3f3e8;
}

.participant-row.stage-bottom td {
  background: #fff1ef;
}

.participant-row.stage-bottom td:first-child {
  box-shadow: inset 4px 0 0 var(--app-danger);
  color: var(--app-danger);
}

.participant-row.stage-bottom:hover td {
  background: #ffe7e3;
}

.participant-row-link {
  color: var(--app-primary-dark);
  font-weight: 900;
}

.participant-row-link::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  content: '';
  cursor: pointer;
}

.participant-row:hover .participant-row-link,
.participant-row-link:focus-visible {
  color: var(--app-primary);
}

.participant-row:has(.participant-row-link:focus-visible) {
  outline: 3px solid rgba(12, 107, 70, 0.18);
  outline-offset: -3px;
}

.total-points {
  display: inline-flex;
  min-width: 34px;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #13231b;
  padding: 0 8px;
  color: white;
  font-weight: 950;
}

tbody tr:last-child td {
  border-bottom: 0;
}
</style>
