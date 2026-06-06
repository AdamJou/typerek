<script setup lang="ts">
import { ChevronRight, Star } from 'lucide-vue-next'
import type { Match, Player, Team } from '~/types/domain'
import type { PlayerNameParts } from '~/utils/footballUi'
import { displayTeamName, formatPlayerNameParts, getTeamFlag } from '~/utils/footballUi'

const props = defineProps<{
  matches: readonly Match[]
  teams: readonly Team[]
  players: readonly Player[]
}>()

const teamsById = computed(() => new Map(props.teams.map((team) => [team.id, team])))
const playersById = computed(() => new Map(props.players.map((player) => [player.id, player])))
const confirmedMatches = computed(() =>
  props.matches
    .filter((match) => isConfirmedResult(match))
    .sort((left, right) => {
      const leftTime = new Date(left.resultConfirmedAt ?? left.startsAtUtc).getTime()
      const rightTime = new Date(right.resultConfirmedAt ?? right.startsAtUtc).getTime()

      return rightTime - leftTime
    }),
)
const previewMatches = computed(() => confirmedMatches.value.slice(0, 3))

function isConfirmedResult(match: Match) {
  return (
    (match.status === 'confirmed' || Boolean(match.resultConfirmedAt)) &&
    match.homeScore90 !== null &&
    match.awayScore90 !== null
  )
}

function teamFor(teamId: string | null) {
  return teamId ? teamsById.value.get(teamId) : undefined
}

function firstScorerName(match: Match): PlayerNameParts {
  if (match.noScorerConfirmed) {
    return { givenInitial: '', surname: 'Brak strzelca' }
  }

  const playerName = playersById.value.get(match.firstScorerPlayerId ?? '')?.name

  return playerName ? formatPlayerNameParts(playerName) : { givenInitial: '', surname: 'Nie podano' }
}
</script>

<template>
  <section class="results-preview section-block">
    <div class="section-heading">
      <div>
        <h2>Wyniki</h2>
      </div>
      <NuxtLink to="/results" class="cta-button">
        Wszystkie
        <ChevronRight :size="16" aria-hidden="true" />
      </NuxtLink>
    </div>

    <p v-if="previewMatches.length === 0" class="empty-preview panel">Wyniki pojawią się po wpisaniu rezultatów przez admina.</p>

    <div v-else class="preview-grid">
      <NuxtLink v-for="match in previewMatches" :key="match.id" class="preview-card panel" to="/results">
        <span class="match-number">{{ match.matchNumber ? `Mecz ${match.matchNumber}` : 'Mecz' }}</span>

        <div class="preview-score-row">
          <span class="team-name">
            <img v-if="getTeamFlag(teamFor(match.homeTeamId)).src" :src="getTeamFlag(teamFor(match.homeTeamId)).src || ''" alt="" />
            {{ displayTeamName(teamFor(match.homeTeamId), match.homePlaceholder ?? 'TBD') }}
          </span>
          <strong>{{ match.homeScore90 }}:{{ match.awayScore90 }}</strong>
          <span class="team-name team-name-away">
            {{ displayTeamName(teamFor(match.awayTeamId), match.awayPlaceholder ?? 'TBD') }}
            <img v-if="getTeamFlag(teamFor(match.awayTeamId)).src" :src="getTeamFlag(teamFor(match.awayTeamId)).src || ''" alt="" />
          </span>
        </div>

        <span class="first-scorer">
          <Star :size="14" aria-hidden="true" />
          <span v-if="firstScorerName(match).givenInitial" class="scorer-given">{{ firstScorerName(match).givenInitial }}</span>
          <strong class="scorer-surname">{{ firstScorerName(match).surname }}</strong>
        </span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.results-preview,
.preview-grid {
  display: grid;
  gap: 12px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.section-heading div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading h2 {
  font-size: 22px;
}

.section-heading p {
  color: var(--app-muted);
  font-size: 13px;
  font-weight: 800;
}

.cta-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--app-primary);
  border-radius: 7px;
  padding: 0 12px;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 900;
}

.cta-button:hover {
  background: var(--app-primary);
  color: white;
}

.empty-preview {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 850;
}

.preview-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  color: inherit;
}

.match-number {
  color: var(--app-muted);
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.preview-score-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
  align-items: center;
  column-gap: 10px;
  width: 100%;
  min-width: 0;
}

.preview-score-row > strong {
  display: inline-flex;
  min-width: 50px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #13231b;
  color: white;
  font-size: 16px;
  font-weight: 950;
}

.team-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;

  font-size: 13px;
  font-weight: 950;
}

.team-name img {
  flex: 0 0 auto;
  width: 24px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
}

.team-name-away {
  justify-content: flex-end;
  text-align: right;
}

.first-scorer {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border-radius: 7px;
  background: #fff2cf;
  padding: 0 8px;
  color: #765813;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scorer-given,
.scorer-surname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scorer-surname {
  font-weight: 950;
}

@media (min-width: 820px) {
  .preview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
