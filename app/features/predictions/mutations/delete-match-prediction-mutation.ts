export async function deleteMatchPredictionMutation(matchId: string) {
  const repository = useTyperekRepository()

  if (!repository) {
    throw new Error('Typowanie jest chwilowo niedostępne.')
  }

  await repository.deleteMatchPrediction(matchId)
}
