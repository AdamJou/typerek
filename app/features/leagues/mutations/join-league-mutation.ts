export async function joinLeagueMutation(code: string) {
  const repository = useTyperekRepository()

  if (!repository) {
    throw new Error('Dołączanie do ligi jest chwilowo niedostępne.')
  }

  return await repository.joinLeagueByCode(code)
}
