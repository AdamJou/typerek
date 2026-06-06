import type { Match, Player, Team } from '~/types/domain'

export function useTeamLookup(teams: readonly Team[], players: readonly Player[]) {
  function getTeam(teamId: string | null | undefined) {
    if (!teamId) {
      return undefined
    }

    return teams.find((team) => team.id === teamId)
  }

  function getPlayer(playerId: string | null) {
    if (!playerId) {
      return null
    }

    return players.find((player) => player.id === playerId) ?? null
  }

  function getMatchTeams(match: Match) {
    return {
      homeTeam: getTeam(match.homeTeamId),
      awayTeam: getTeam(match.awayTeamId),
    }
  }

  function getPlayersForMatch(match: Match) {
    const teamIds = new Set([match.homeTeamId, match.awayTeamId].filter(Boolean))
    return players.filter((player) => player.active && teamIds.has(player.teamId))
  }

  return {
    getTeam,
    getPlayer,
    getMatchTeams,
    getPlayersForMatch,
  }
}
