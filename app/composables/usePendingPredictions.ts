import { isMatchPredictionOpen } from '~/utils/scoring'

export function usePendingPredictions() {
  const { currentStage, currentUserId, hasLeague, matches, predictions, stages, teams } = useTyperekData()

  const predictionMatchIds = computed(
    () =>
      new Set(
        predictions.value
          .filter((prediction) => prediction.userId === currentUserId.value)
          .map((prediction) => prediction.matchId),
      ),
  )
  const teamIds = computed(() => new Set(teams.map((team) => team.id)))
  const currentStagePendingCount = computed(() => {
    if (!hasLeague.value || !currentUserId.value || !currentStage.value) {
      return 0
    }

    return matches.filter(
      (match) =>
        match.stageId === currentStage.value?.id &&
        Boolean(match.homeTeamId && teamIds.value.has(match.homeTeamId)) &&
        Boolean(match.awayTeamId && teamIds.value.has(match.awayTeamId)) &&
        isMatchPredictionOpen(match, stages, matches) &&
        !predictionMatchIds.value.has(match.id),
    ).length
  })

  return {
    currentStagePendingCount,
  }
}
