<script setup lang="ts">
import type { BonusStatisticCard, Team } from '~/types/domain'
import { displayTeamName, getTeamFlag } from '~/utils/footballUi'

const props = defineProps<{
  card: BonusStatisticCard
  memberCount: number
  teams: readonly Team[]
}>()

const teamById = computed(() => new Map(props.teams.map((team) => [team.id, team])))
const resolvedGroups = computed(() =>
  (props.card.groups ?? []).map((group) => ({
    ...group,
    teams: group.teams.map((team, index) => {
      const resolvedTeam = teamById.value.get(team.key)

      return {
        ...team,
        position: index + 1,
        label: displayTeamName(resolvedTeam, team.key),
        flag: getTeamFlag(resolvedTeam),
      }
    }),
  })),
)

function formatAverage(value: number) {
  return value.toLocaleString('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
</script>

<template>
  <article class="groups-card panel">
    <header class="groups-header">
      <div>
        <span>Konsensus ligi</span>
        <h2>{{ card.title }}</h2>
      </div>
      <strong>{{ card.respondentCount }}/{{ memberCount }} odpowiedziało</strong>
    </header>

    <div v-if="resolvedGroups.length" class="groups-grid">
      <section v-for="group in resolvedGroups" :key="group.groupCode" class="group-table">
        <div class="group-heading">
          <h3>Grupa {{ group.groupCode }}</h3>
          <span>{{ group.respondentCount }}/{{ memberCount }}</span>
        </div>

        <ol class="group-list">
          <li v-for="team in group.teams" :key="team.key">
            <span class="position">{{ team.position }}</span>
            <span class="flag" aria-hidden="true">
              <img v-if="team.flag.src" :src="team.flag.src" :alt="team.flag.alt">
              <span v-else>{{ team.flag.emoji }}</span>
            </span>
            <strong>{{ team.label }}</strong>
            <span class="average">śr. {{ formatAverage(team.averagePosition) }}</span>
          </li>
        </ol>
      </section>
    </div>

    <p v-else class="empty-copy">Brak kompletnych typów grupowych.</p>
  </article>
</template>

<style scoped>
.groups-card {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.groups-header,
.group-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.groups-header {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--app-line);
}

.groups-header > div {
  display: grid;
  gap: 4px;
}

.groups-header span,
.groups-header > strong,
.group-heading span {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.groups-header h2,
.group-heading h3,
.empty-copy {
  margin: 0;
}

.groups-header h2 {
  font-size: 22px;
}

.groups-grid {
  display: grid;
  gap: 12px;
}

.group-table {
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: white;
}

.group-heading {
  align-items: center;
  background: #eef5ef;
  padding: 10px 12px;
}

.group-heading h3 {
  font-size: 14px;
}

.group-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.group-list li {
  display: grid;
  grid-template-columns: 28px 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--app-line);
  padding: 10px 12px;
}

.group-list li:first-child {
  border-top: 0;
}

.position {
  display: inline-flex;
  width: 25px;
  height: 25px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--app-primary-dark);
  color: white;
  font-size: 11px;
  font-weight: 950;
}

.flag {
  display: inline-flex;
  width: 26px;
  height: 19px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 3px;
  font-size: 18px;
}

.flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-list strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.average {
  color: var(--app-primary-dark);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.empty-copy {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 700;
}

@media (min-width: 760px) {
  .groups-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
