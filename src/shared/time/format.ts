const DAY_MS = 24 * 60 * 60 * 1000

export function formatTime(isoUtc: string, locale?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return fmt.format(new Date(isoUtc))
}

export function formatDate(isoUtc: string, locale?: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
  return fmt.format(new Date(isoUtc))
}

export function formatRelativeDay(isoUtc: string, now?: number, locale: string = 'es-AR'): string {
  const target = new Date(isoUtc).getTime()
  const reference = now ?? Date.parse(isoUtc)

  const targetDay = startOfLocalDay(target)
  const referenceDay = startOfLocalDay(reference)
  const diffDays = Math.round((targetDay - referenceDay) / DAY_MS)

  if (diffDays === 0) return 'hoy'
  if (diffDays === 1) return 'mañana'
  if (diffDays === 2) return 'pasado'
  return formatDate(isoUtc, locale)
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
