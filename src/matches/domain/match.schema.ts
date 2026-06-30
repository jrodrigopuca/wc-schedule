import { z } from 'zod'
import type { Match } from './match'

const UTC_KICKOFF_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/

const ISO_CODE_REGEX = /^[a-z]{2}$/
const GROUP_REGEX = /^[A-L]$/

const teamSchema = z.object({
  iso: z.string().regex(ISO_CODE_REGEX),
  name: z.string().min(1),
})

const scoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
})

const penaltyScoreSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
})

const venueSchema = z.object({
  city: z.string().min(1),
  country: z.string().min(1),
})

// `.transform(stripUndefined)` removes keys whose parsed value is `undefined`,
// so the OUTPUT object only carries optional fields when they were actually
// present in the input. This is what makes the inferred type compatible with
// `exactOptionalPropertyTypes: true` (where `?: T` is NOT the same as
// `?: T | undefined`).
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const key in obj) {
    const value = obj[key]
    if (value !== undefined) out[key] = value
  }
  return out as T
}

export const matchSchema = z
  .object({
    id: z.string().min(1),
    utcKickoff: z.string().regex(UTC_KICKOFF_REGEX),
    status: z.enum(['scheduled', 'live', 'finished', 'postponed', 'cancelled']),
    stage: z.enum([
      'group',
      'round-of-32',
      'round-of-16',
      'quarter-final',
      'semi-final',
      'third-place',
      'final',
    ]),
    group: z.string().regex(GROUP_REGEX).optional(),
    teamA: teamSchema,
    teamB: teamSchema,
    score: scoreSchema.optional(),
    penalties: penaltyScoreSchema.optional(),
    venue: venueSchema.optional(),
  })
  .transform((m): Match => stripUndefined(m) as Match)

export const matchListSchema = z.array(matchSchema).readonly()

export type ValidatedMatch = z.infer<typeof matchSchema>

// Compile-time guarantee that the schema and the hand-written `Match`
// interface never drift. If this errors, fix the SCHEMA, not the type.
type _SchemaMatchesType = ValidatedMatch extends Match ? true : never
const _schemaMatchesType: _SchemaMatchesType = true
void _schemaMatchesType
