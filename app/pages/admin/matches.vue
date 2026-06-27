<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import type { Match, MatchEvent, Player, Team, TournamentStage } from '~/types/domain'
import { displayTeamName } from '~/utils/footballUi'

interface MatchEditorRow {
  match: Match
  matchEvents: readonly MatchEvent[]
  homeTeam?: Team
  awayTeam?: Team
  players: readonly Player[]
}

interface MatchEditorGroup {
  stage: TournamentStage
  rows: MatchEditorRow[]
}

const { matchEvents, matches, players, stages, teams } = useTyperekData()
const { getMatchTeams, getPlayersForMatch } = useTeamLookup(teams, players)
const searchQuery = shallowRef('')
const hideSavedMatches = shallowRef(true)

const matchEditorRows = computed<MatchEditorRow[]>(() => {
  const rows: MatchEditorRow[] = []

  for (const match of matches) {
    const { homeTeam, awayTeam } = getMatchTeams(match)
    const stage = stages.find((candidate) => candidate.id === match.stageId)
    const canAssignTeamsManually = stage?.code === 'round_of_32'

    if ((!homeTeam || !awayTeam) && !canAssignTeamsManually) {
      continue
    }

    rows.push({
      match,
      matchEvents: matchEvents.filter((event) => event.matchId === match.id),
      homeTeam,
      awayTeam,
      players: getPlayersForMatch(match),
    })
  }

  return rows
})

const filteredMatchEditorRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return matchEditorRows.value.filter((row) => {
    if (hideSavedMatches.value && hasSavedResult(row.match)) {
      return false
    }

    return query ? matchSearchText(row).includes(query) : true
  })
})

const matchEditorGroups = computed<MatchEditorGroup[]>(() =>
  stages
    .map((stage) => ({
      stage,
      rows: filteredMatchEditorRows.value
        .filter((row) => row.match.stageId === stage.id)
        .sort((left, right) => {
          const numberDelta = (left.match.matchNumber ?? Number.MAX_SAFE_INTEGER) - (right.match.matchNumber ?? Number.MAX_SAFE_INTEGER)

          if (numberDelta !== 0) {
            return numberDelta
          }

          return left.match.startsAtUtc.localeCompare(right.match.startsAtUtc)
        }),
    }))
    .filter((group) => group.rows.length > 0),
)

const visibleMatchCount = computed(() => filteredMatchEditorRows.value.length)

function hasSavedResult(match: Match) {
  return match.status === 'confirmed' || Boolean(match.resultConfirmedAt) || (match.homeScore90 !== null && match.awayScore90 !== null)
}

function matchSearchText(row: MatchEditorRow) {
  const stage = stages.find((candidate) => candidate.id === row.match.stageId)
  const values = [
    row.match.matchNumber ? `mecz ${row.match.matchNumber}` : '',
    row.match.roundName,
    row.match.groupCode ? `grupa ${row.match.groupCode}` : '',
    row.match.venue,
    stage?.name,
    stage?.shortName,
    displayTeamName(row.homeTeam, row.match.homePlaceholder ?? ''),
    displayTeamName(row.awayTeam, row.match.awayPlaceholder ?? ''),
  ]

  return values.filter(Boolean).join(' ').toLowerCase()
}

function matchCountLabel(count: number) {
  if (count === 1) {
    return '1 mecz'
  }

  if (count >= 2 && count <= 4) {
    return `${count} mecze`
  }

  return `${count} meczów`
}
</script>

<template>
  <section class="admin-page">
    <div class="page-heading">
      <h1>Wyniki meczów</h1>
      <p>Ręczne zapisanie wyniku ustawia mecz jako potwierdzony i przelicza punkty za ten mecz.</p>
    </div>

    <div class="admin-filters">
      <label class="search-field">
        <Search :size="17" aria-hidden="true" />
        <input v-model="searchQuery" type="search" placeholder="Szukaj drużyny, meczu, kolejki" />
      </label>

      <label class="filter-check">
        <input v-model="hideSavedMatches" type="checkbox" />
        <span>Ukryj zapisane wyniki</span>
      </label>

      <strong>{{ matchCountLabel(visibleMatchCount) }}</strong>
    </div>

    <p v-if="visibleMatchCount === 0" class="empty-results">Brak meczów dla tych filtrów.</p>

    <div v-else class="match-editor-groups">
      <section v-for="group in matchEditorGroups" :key="group.stage.id" class="match-editor-group">
        <div class="match-group-heading">
          <div>
            <span>{{ group.stage.shortName }}</span>
            <h2>{{ group.stage.name }}</h2>
          </div>
          <strong>{{ matchCountLabel(group.rows.length) }}</strong>
        </div>

        <div class="match-editor-list">
          <div v-for="row in group.rows" :key="row.match.id" class="match-management-stack">
            <AdminMatchTeamsEditor
              v-if="group.stage.code === 'round_of_32'"
              :match="row.match"
              :teams="teams"
            />
            <AdminMatchEditor
              v-if="row.homeTeam && row.awayTeam"
              :match="row.match"
              :stage="group.stage"
              :match-events="row.matchEvents"
              :home-team="row.homeTeam"
              :away-team="row.awayTeam"
              :players="row.players"
            />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-page,
.page-heading,
.admin-filters,
.match-editor-groups,
.match-editor-group,
.match-editor-list {
  display: grid;
  gap: 16px;
}

.admin-filters,
.match-editor-groups,
.empty-results {
  width: 100%;

}

.page-heading h1,
.page-heading p {
  margin: 0;
}

.page-heading h1 {
  font-size: clamp(32px, 8vw, 48px);
  line-height: 1;
}

.page-heading p {
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 700;
}

.admin-filters {
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
}

.search-field {
  display: flex;
  min-width: 0;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #ffffff;
  padding: 0 12px;
  color: var(--app-muted);
}

.search-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--app-ink);
  font-size: 14px;
  font-weight: 850;
  outline: none;
}

.filter-check {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--app-line);
  border-radius: 8px;
  background: #fbfdf9;
  padding: 0 12px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
  white-space: nowrap;
}

.filter-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--app-primary);
}

.admin-filters > strong {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  border-radius: 8px;
  background: #eef4ef;
  padding: 0 12px;
  color: var(--app-primary-dark);
  font-size: 12px;
  font-weight: 950;
  white-space: nowrap;
}

.empty-results {
  margin: 0;
  border: 1px dashed var(--app-line);
  border-radius: 8px;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 850;
}

.match-editor-group {
  gap: 12px;
}

.match-management-stack {
  display: grid;
  gap: 8px;
}

.match-group-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--app-line);
  padding-bottom: 10px;
}

.match-group-heading div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.match-group-heading span,
.match-group-heading strong {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.match-group-heading h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.15;
}

.match-group-heading strong {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border-radius: 7px;
  background: #eef4ef;
  padding: 0 10px;
  color: var(--app-primary-dark);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .admin-filters {
    grid-template-columns: 1fr;
  }

  .filter-check,
  .admin-filters > strong {
    justify-content: center;
  }
}
</style>
