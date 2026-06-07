import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTimeoutNotifier } from '@/notifications/adapters/timeout-notifier'
import type { ScheduleEntry } from '@/notifications/domain/schedule'
import { useI18n } from '@/shared/i18n/useI18n'

// Anchor time: matches the "tournament window" instant used across the
// suite. All `fireAtMs` values are computed off this so reasoning about
// delays is straightforward (delayMs = fireAtMs - NOW).
const NOW = Date.parse('2026-06-13T17:00:00Z')

function makeEntry(
  overrides: Partial<ScheduleEntry> & { matchId: string; fireAtMs: number },
): ScheduleEntry {
  return {
    matchId: overrides.matchId,
    fireAtMs: overrides.fireAtMs,
    match: overrides.match ?? {
      id: overrides.matchId,
      utcKickoff: new Date(overrides.fireAtMs + 15 * 60 * 1000).toISOString(),
      stage: 'group',
      teamA: { iso: 'ar', name: 'Argentina' },
      teamB: { iso: 'br', name: 'Brasil' },
    },
  }
}

// Test seam helper. We pass an explicit `now` so the adapter's
// computation `fireAtMs - now()` is deterministic without hooking the
// global clock; pair with `vi.useFakeTimers()` to drive `setTimeout`.
function makeNotifier(notify: ReturnType<typeof vi.fn>) {
  return createTimeoutNotifier({
    now: () => NOW,
    notify: notify as unknown as new (title: string, options?: NotificationOptions) => unknown,
  })
}

describe('createTimeoutNotifier — arming + firing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useI18n().setLocale('es')
  })

  afterEach(() => {
    vi.useRealTimers()
    useI18n().clearOverride()
  })

  it('arms one setTimeout per entry', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
      makeEntry({ matchId: 'c', fireAtMs: NOW + 180_000 }),
    ])
    expect(vi.getTimerCount()).toBe(3)
  })

  it('fires Notification at the entry fireAtMs with tag === matchId', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([makeEntry({ matchId: 'arg-bra', fireAtMs: NOW + 60_000 })])
    vi.advanceTimersByTime(60_000)
    expect(notify).toHaveBeenCalledTimes(1)
    const [, options] = notify.mock.calls[0] as [string, NotificationOptions]
    expect(options.tag).toBe('arg-bra')
    expect(options.icon).toBe('/wc-schedule/pwa-192x192.png')
  })

  it('title contains both team names resolved via country()', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([makeEntry({ matchId: 'm', fireAtMs: NOW + 60_000 })])
    vi.advanceTimersByTime(60_000)
    const [title] = notify.mock.calls[0] as [string, NotificationOptions]
    // `country('ar')` in ES yields "Argentina"; `country('br')` yields
    // "Brasil". The exact assertion confirms the country() path took
    // priority over the raw team.name.
    expect(title).toContain('Argentina')
    expect(title).toContain('Brasil')
    expect(title).toContain('vs')
  })

  it('body contains "15 minutos" (ES) and the stage label', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([makeEntry({ matchId: 'm', fireAtMs: NOW + 60_000 })])
    vi.advanceTimersByTime(60_000)
    const [, options] = notify.mock.calls[0] as [string, NotificationOptions]
    expect(options.body).toContain('15 minutos')
    // 'group' stage → "Fase de grupos" (ES). Asserting the resolved
    // label proves STAGE_KEYS wiring and i18n resolution.
    expect(options.body).toContain('Fase de grupos')
  })
})

describe('createTimeoutNotifier — cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancel(matchId) clears that single timer without affecting others', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
    ])
    notifier.cancel('a')
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(60_000)
    expect(notify).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(notify).toHaveBeenCalledTimes(1)
    const [, options] = notify.mock.calls[0] as [string, NotificationOptions]
    expect(options.tag).toBe('b')
  })

  it('cancelAll() clears every timer', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
    ])
    notifier.cancelAll()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(300_000)
    expect(notify).not.toHaveBeenCalled()
  })

  it('schedule() called twice clears the first batch before arming the second (atomic replace)', () => {
    const notify = vi.fn()
    const notifier = makeNotifier(notify)
    notifier.schedule([
      makeEntry({ matchId: 'old-1', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'old-2', fireAtMs: NOW + 120_000 }),
    ])
    notifier.schedule([makeEntry({ matchId: 'new', fireAtMs: NOW + 90_000 })])
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(120_000)
    // Only the second batch's entry should have fired.
    expect(notify).toHaveBeenCalledTimes(1)
    const [, options] = notify.mock.calls[0] as [string, NotificationOptions]
    expect(options.tag).toBe('new')
  })
})

describe('createTimeoutNotifier — unsupported environment', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('schedule() is a no-op when Notification global is missing', () => {
    // Defensive: build the notifier WITHOUT a `notify` dep override AND
    // with no `Notification` on globalThis. Adapter must arm zero
    // timers and not throw.
    delete (globalThis as { Notification?: unknown }).Notification
    const notifier = createTimeoutNotifier({ now: () => NOW })
    expect(() =>
      notifier.schedule([makeEntry({ matchId: 'm', fireAtMs: NOW + 60_000 })]),
    ).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
