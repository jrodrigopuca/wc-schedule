import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShowTriggerNotifier } from '@/notifications/adapters/show-trigger-notifier'
import type { ScheduleEntry } from '@/notifications/domain/schedule'
import { useI18n } from '@/shared/i18n/useI18n'

// Anchor matches the rest of the suite ("during the tournament" instant).
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
      teamB: { iso: 'ma', name: 'Marruecos' },
    },
  }
}

// Sentinel constructor for the trigger value. We assert
// `showTrigger instanceof TT` so the adapter is wired to call our
// injected factory and not the real TimestampTrigger global.
class TT {
  constructor(public ts: number) {}
}

interface PendingNotification {
  readonly tag: string
  close: ReturnType<typeof vi.fn>
}

interface FakeRegistration {
  showNotification: ReturnType<typeof vi.fn>
  getNotifications: ReturnType<typeof vi.fn>
  pending: PendingNotification[]
}

function makeFakeRegistration(opts: { showThrowsForMatchId?: string } = {}): FakeRegistration {
  const pending: PendingNotification[] = []
  const showNotification = vi.fn(async (_title: string, options: Record<string, unknown>) => {
    const tag = options.tag as string
    if (opts.showThrowsForMatchId !== undefined && tag.endsWith(opts.showThrowsForMatchId)) {
      throw new Error('simulated showNotification failure')
    }
    pending.push({
      tag,
      close: vi.fn(() => {
        const idx = pending.findIndex((p) => p.tag === tag)
        if (idx >= 0) pending.splice(idx, 1)
      }),
    })
  })
  const getNotifications = vi.fn(async (filter?: { includeTriggered?: boolean; tag?: string }) => {
    if (filter?.tag !== undefined) {
      return pending.filter((n) => n.tag === filter.tag)
    }
    return [...pending]
  })
  return {
    showNotification,
    getNotifications,
    pending,
  }
}

describe('createShowTriggerNotifier — schedule()', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
  })

  afterEach(() => {
    useI18n().clearOverride()
  })

  it('arms showNotification once per entry with the right tag and trigger', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    const entries = [
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
      makeEntry({ matchId: 'c', fireAtMs: NOW + 180_000 }),
    ]
    // Cast to the adapter's actual async return (it satisfies the
    // void-port shape but returns a Promise we can await).
    await (notifier.schedule(entries) as unknown as Promise<void>)
    expect(reg.showNotification).toHaveBeenCalledTimes(3)
    for (const call of reg.showNotification.mock.calls) {
      const [, options] = call as [string, Record<string, unknown>]
      expect(typeof options.tag).toBe('string')
      expect((options.tag as string).startsWith('wc2026-')).toBe(true)
      expect(options.showTrigger).toBeInstanceOf(TT)
    }
  })

  it('resolves title and body via i18n at SCHEDULE time (ES locale pinned)', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'arg-mar', fireAtMs: NOW + 60_000 }),
    ]) as unknown as Promise<void>)
    const [title, options] = reg.showNotification.mock.calls[0] as [string, Record<string, unknown>]
    expect(title).toBe('Argentina vs Marruecos')
    expect(options.body).toBe('Empieza en 15 minutos · Fase de grupos')
  })

  it('passes the BASE_URL-prefixed icon path', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
      iconPath: '/wc-schedule/pwa-192x192.png',
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'm', fireAtMs: NOW + 60_000 }),
    ]) as unknown as Promise<void>)
    const [, options] = reg.showNotification.mock.calls[0] as [string, Record<string, unknown>]
    expect(options.icon).toBe('/wc-schedule/pwa-192x192.png')
    expect(options.silent).toBe(false)
  })

  it('continues scheduling other entries when one showNotification throws', async () => {
    const reg = makeFakeRegistration({ showThrowsForMatchId: 'bad' })
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await (notifier.schedule([
      makeEntry({ matchId: 'good-1', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'bad', fireAtMs: NOW + 120_000 }),
      makeEntry({ matchId: 'good-2', fireAtMs: NOW + 180_000 }),
    ]) as unknown as Promise<void>)
    expect(reg.showNotification).toHaveBeenCalledTimes(3)
    // Only the two successful ids should remain pending.
    expect(reg.pending.map((p) => p.tag)).toEqual(['wc2026-good-1', 'wc2026-good-2'])
    consoleWarn.mockRestore()
  })

  it('clears the previous batch before arming the second (atomic replace)', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'old-1', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'old-2', fireAtMs: NOW + 120_000 }),
    ]) as unknown as Promise<void>)
    expect(reg.pending.map((p) => p.tag)).toEqual(['wc2026-old-1', 'wc2026-old-2'])

    await (notifier.schedule([
      makeEntry({ matchId: 'new-1', fireAtMs: NOW + 90_000 }),
    ]) as unknown as Promise<void>)
    expect(reg.pending.map((p) => p.tag)).toEqual(['wc2026-new-1'])
  })
})

describe('createShowTriggerNotifier — cancellation', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
  })

  afterEach(() => {
    useI18n().clearOverride()
  })

  it('cancel(matchId) closes the matching pending notification by tag', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
    ]) as unknown as Promise<void>)
    await (notifier.cancel('a') as unknown as Promise<void>)
    expect(reg.getNotifications).toHaveBeenCalled()
    // `a` should be gone; `b` remains.
    expect(reg.pending.map((p) => p.tag)).toEqual(['wc2026-b'])
  })

  it('cancelAll() closes every pending notification we armed', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'a', fireAtMs: NOW + 60_000 }),
      makeEntry({ matchId: 'b', fireAtMs: NOW + 120_000 }),
      makeEntry({ matchId: 'c', fireAtMs: NOW + 180_000 }),
    ]) as unknown as Promise<void>)
    await (notifier.cancelAll() as unknown as Promise<void>)
    expect(reg.pending).toEqual([])
  })

  it('cancelAll() with nothing scheduled is a no-op and does NOT call SW', async () => {
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: async () => reg,
      trigger: (ts) => new TT(ts),
    })
    await (notifier.cancelAll() as unknown as Promise<void>)
    // Never reached out for the registration because the tracked set is
    // empty — saves a round trip when nothing was ever scheduled.
    expect(reg.getNotifications).not.toHaveBeenCalled()
  })
})
