import type { LeagueMember, MatchPrediction, MatchPredictionPresence } from '~/types/domain'

export function usePredictionParticipants(
  members: readonly LeagueMember[],
  predictionPresence: Readonly<Ref<readonly MatchPredictionPresence[]>>,
  predictions: Readonly<Ref<readonly MatchPrediction[]>>,
) {
  const membersById = computed(() => new Map(members.map((member) => [member.userId, member])))
  const membersByMatchId = computed(() => {
    const result = new Map<string, LeagueMember[]>()
    const presence = new Map<string, MatchPredictionPresence>()

    for (const item of [...predictionPresence.value, ...predictions.value]) {
      presence.set(`${item.matchId}:${item.userId}`, {
        matchId: item.matchId,
        userId: item.userId,
      })
    }

    for (const item of presence.values()) {
      const member = membersById.value.get(item.userId)

      if (member) {
        const matchMembers = result.get(item.matchId) ?? []
        matchMembers.push(member)
        result.set(item.matchId, matchMembers)
      }
    }

    return result
  })

  function predictionMembersFor(matchId: string) {
    return membersByMatchId.value.get(matchId) ?? []
  }

  return {
    predictionMembersFor,
  }
}
