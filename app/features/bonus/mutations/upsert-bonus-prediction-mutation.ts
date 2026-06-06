export async function upsertBonusPredictionMutation(questionId: string, answerJson: Record<string, unknown> | null) {
  const repository = useTyperekRepository()

  if (!repository) {
    throw new Error('Typowanie bonusów jest chwilowo niedostępne.')
  }

  return await repository.upsertBonusPrediction({ questionId, answerJson })
}
