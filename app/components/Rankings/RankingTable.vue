<script setup lang="ts">
import type { RankingRow } from '~/types/domain'

defineProps<{
  rows: readonly RankingRow[]
  mode?: 'general' | 'stage'
}>()
</script>

<template>
  <div class="ranking-table panel">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Gracz</th>
          <th>Suma</th>
          <th v-if="mode !== 'stage'">Etap</th>
          <th>Wynik</th>
          <th>Dokł.</th>
          <th>Strz.</th>
          <th>Bonus</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.userId">
          <td>{{ index + 1 }}</td>
          <td>{{ row.displayName }}</td>
          <td><strong>{{ row.totalPoints }}</strong></td>
          <td v-if="mode !== 'stage'">{{ row.stagePoints }}</td>
          <td>{{ row.outcomePoints }}</td>
          <td>{{ row.exactScorePoints }}</td>
          <td>{{ row.firstScorerPoints }}</td>
          <td>{{ row.bonusPoints }}</td>
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
}

tbody tr:last-child td {
  border-bottom: 0;
}
</style>
