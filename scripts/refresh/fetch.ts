// Network tier of the refresh pipeline (design.md §10, tasks T11.2).
//
// Reads the upstream credential from `FOOTBALL_DATA_TOKEN` — a PLAIN env var,
// NEVER `VITE_`-prefixed, so Vite can never inline it into the client bundle
// (data-source.md §8: the token MUST exist only in the pipeline's secret
// store). Calls football-data.org, then hands the raw payload to the pure
// `transform` so the only thing that touches the network stays I/O-thin.

import { transform, type UpstreamResponse } from './transform.ts'
import type { Match } from '../../src/matches/domain/match.ts'

// FIFA World Cup competition code on football-data.org is "WC".
const DEFAULT_BASE_URL = 'https://api.football-data.org/v4'
const DEFAULT_COMPETITION = 'WC'

export function readToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = env.FOOTBALL_DATA_TOKEN
  if (!token || token.trim() === '') {
    throw new Error(
      'fetch: FOOTBALL_DATA_TOKEN is not set — refusing to call upstream without a credential',
    )
  }
  return token
}

export async function fetchMatches(env: NodeJS.ProcessEnv = process.env): Promise<Match[]> {
  const token = readToken(env)
  const baseUrl = env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_BASE_URL
  const competition = env.FOOTBALL_DATA_COMPETITION ?? DEFAULT_COMPETITION

  const response = await fetch(`${baseUrl}/competitions/${competition}/matches`, {
    headers: { 'X-Auth-Token': token },
  })
  if (!response.ok) {
    throw new Error(`fetch: upstream responded ${response.status} ${response.statusText}`)
  }

  const payload = (await response.json()) as UpstreamResponse
  const matches = transform(payload)
  logPenaltyShootoutPayloads(payload, matches)
  return matches
}

function logPenaltyShootoutPayloads(payload: UpstreamResponse, matches: readonly Match[]): void {
  const transformedById = new Map(matches.map((match) => [match.id, match] as const))

  for (const match of payload.matches) {
    if (match.score?.duration !== 'PENALTY_SHOOTOUT') continue

    const transformed = transformedById.get(toMatchId(match.id))
    console.log(
      `[refresh] penalty-shootout raw=${JSON.stringify({
        id: match.id,
        utcDate: match.utcDate,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        score: match.score,
      })}`,
    )
    console.log(
      `[refresh] penalty-shootout normalized=${JSON.stringify({
        id: transformed?.id ?? toMatchId(match.id),
        score: transformed?.score,
        penalties: transformed?.penalties,
      })}`,
    )
  }
}

function toMatchId(id: number): string {
  return `fd-${id}`
}
