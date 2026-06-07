// ICS (RFC 5545) builder for a single Match. Pure, framework-free, locale-
// agnostic — the caller injects an `IcsRenderContext` with resolved name /
// stage / app-url. That keeps the domain layer free of any i18n coupling
// while still producing locale-aware SUMMARY / DESCRIPTION fields.
//
// Trade-offs documented:
//   - "Grupo {X}" is kept as literal Spanish in the DESCRIPTION. We accept
//     a single hybrid line for MVP rather than threading another i18n key
//     through the context; the rest of the description (stage label) IS
//     localized. Documented in design.md §18.
//   - Long-line folding (>75 octets → CRLF + space continuation) is skipped
//     for MVP. Real-world calendar apps accept unfolded long lines; the
//     spec recommends folding but does not strictly require it for
//     interoperability with mainstream clients.

import type { Match, Stage } from './match'

export interface IcsRenderContext {
  readonly resolveTeamName: (iso: string, fallback: string) => string
  readonly resolveStageLabel: (stage: Stage) => string
  readonly appUrl: string
}

const PRODID = '-//WC Schedule//Mundial 2026//EN'
const EVENT_DURATION_MINUTES = 120
const CRLF = '\r\n'

export function buildMatchIcs(match: Match, ctx: IcsRenderContext, now: number): string {
  const dtStamp = formatIcsDate(now)
  const kickoffMs = Date.parse(match.utcKickoff)
  const dtStart = formatIcsDate(kickoffMs)
  const dtEnd = formatIcsDate(kickoffMs + EVENT_DURATION_MINUTES * 60_000)

  const summary = escapeText(
    `${ctx.resolveTeamName(match.teamA.iso, match.teamA.name)} vs ${ctx.resolveTeamName(
      match.teamB.iso,
      match.teamB.name,
    )}`,
  )

  const stageLabel = ctx.resolveStageLabel(match.stage)
  const groupSuffix = match.group !== undefined ? ` · Grupo ${match.group}` : ''
  const description = escapeText(`${stageLabel}${groupSuffix} · Mundial 2026`)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${match.id}@wc-schedule.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
  ]

  if (match.venue !== undefined) {
    const location = escapeText(`${match.venue.city}, ${match.venue.country}`)
    lines.push(`LOCATION:${location}`)
  }

  lines.push(`URL:${ctx.appUrl}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR')

  return lines.join(CRLF) + CRLF
}

function formatIcsDate(ms: number): string {
  const date = new Date(ms)
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0')
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = date.getUTCDate().toString().padStart(2, '0')
  const hh = date.getUTCHours().toString().padStart(2, '0')
  const mi = date.getUTCMinutes().toString().padStart(2, '0')
  const ss = date.getUTCSeconds().toString().padStart(2, '0')
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}
