import type { UpsertMatchPredictionPayload } from '~/repositories/TyperekRepository'

export async function upsertMatchPredictionMutation(payload: UpsertMatchPredictionPayload) {
  const repository = useTyperekRepository()

  if (!repository) {
    throw new Error('Typowanie jest chwilowo niedostępne.')
  }

  return await repository.upsertMatchPrediction(payload)
}
