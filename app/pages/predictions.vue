<script setup lang="ts">
const { currentUserId, hasLoaded, matchEvents, matches, members, players, predictionPresence, predictions, stages, teams } = useTyperekData()
const { getMatchTeams, getPlayer } = useTeamLookup(teams, players)
const { predictionMembersFor } = usePredictionParticipants(members, predictionPresence, predictions)
const currentMember = computed(() => members.find((member) => member.userId === currentUserId.value))
const ownPredictions = computed(() =>
  predictions.value.filter((prediction) => prediction.userId === currentUserId.value),
)

function matchFor(matchId: string) {
  return matches.find((match) => match.id === matchId)
}

function matchEventsFor(matchId: string) {
  return matchEvents.filter((event) => event.matchId === matchId)
}

function predictionsFor(matchId: string) {
  return predictions.value.filter((prediction) => prediction.matchId === matchId)
}

function stageFor(stageId: string) {
  return stages.find((stage) => stage.id === stageId)
}
</script>

<template>
  <section class="predictions-page">
    <BackLink to="/league" label="Wróć do ligi" />

    <div class="page-heading">
      <h1>Historia typów</h1>
      <p>Własne typy są zawsze widoczne. Typy innych graczy pokażą się dopiero po starcie meczu.</p>
    </div>

    <div class="prediction-list">
      <p v-if="hasLoaded && ownPredictions.length === 0" class="state-panel panel">Nie masz jeszcze zapisanych typów.</p>

      <article v-for="prediction in ownPredictions" :key="prediction.id" class="prediction-row">
        <template v-if="matchFor(prediction.matchId)">
          <MatchCard
            :match="matchFor(prediction.matchId)!"
            :match-events="matchEventsFor(prediction.matchId)"
            :home-team="getMatchTeams(matchFor(prediction.matchId)!).homeTeam"
            :away-team="getMatchTeams(matchFor(prediction.matchId)!).awayTeam"
            :stage="stageFor(matchFor(prediction.matchId)!.stageId)!"
            :to="`/matches/${prediction.matchId}`"
            :prediction="prediction"
            :match-predictions="predictionsFor(prediction.matchId)"
            :current-member="currentMember"
            :players="players"
            :first-scorer="getPlayer(prediction.firstScorerPlayerId)"
            :predicted-members="predictionMembersFor(prediction.matchId)"
          />
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.predictions-page,
.page-heading,
.prediction-list {
  display: grid;
  gap: 16px;
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

.prediction-row {
  display: grid;
  gap: 10px;
  padding: 0 0 14px;
}

.prediction-row strong {
  padding-inline: 16px;
}

.state-panel {
  margin: 0;
  padding: 14px;
  color: var(--app-muted);
  font-size: 14px;
  font-weight: 800;
}
</style>
