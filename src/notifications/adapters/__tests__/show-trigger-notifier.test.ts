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
//
// NOTE: `erasableSyntaxOnly` in tsconfig.app.json bans parameter
// properties — use an explicit field + assignment instead.
class TT {
  public ts: number
  constructor(ts: number) {
    this.ts = ts
  }
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

function makeFakeRegistration(
  opts: {
    readonly showThrowsForMatchId?: string
    // Seed the OS-level pending list with notifications that the
    // registration "already holds" (e.g. left over from a previous
    // session before the tab was closed). The orphan-cleanup path in
    // `schedule()` enumerates these via `getNotifications`.
    readonly seedTags?: readonly string[]
  } = {},
): FakeRegistration {
  const pending: PendingNotification[] = []
  const enroll = (tag: string): void => {
    pending.push({
      tag,
      close: vi.fn(() => {
        const idx = pending.findIndex((p) => p.tag === tag)
        if (idx >= 0) pending.splice(idx, 1)
      }),
    })
  }
  for (const seed of opts.seedTags ?? []) enroll(seed)
  const showNotification = vi.fn(async (_title: string, options: Record<string, unknown>) => {
    const tag = options.tag as string
    if (opts.showThrowsForMatchId !== undefined && tag.endsWith(opts.showThrowsForMatchId)) {
      throw new Error('simulated showNotification failure')
    }
    // Spec-defined tag-replace: if a same-tag entry already exists,
    // drop it before adding the new one. Mirrors what Chromium does
    // under the hood and keeps the fake consistent with the
    // "re-arming is idempotent" contract.
    const existingIdx = pending.findIndex((p) => p.tag === tag)
    if (existingIdx >= 0) pending.splice(existingIdx, 1)
    enroll(tag)
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

// `vi.fn` infers its mock signature as the wide `Procedure | Constructable`
// union, which strict structural typing in tsconfig.app.json refuses to
// match against the adapter's narrow `(title, options) => Promise<void>`
// shape on `ServiceWorkerRegistrationLike`. The DI seam doesn't care —
// we route the FakeRegistration through `unknown` at the boundary, which
// preserves runtime behavior and the assertion power of `vi.fn` while
// keeping vue-tsc happy. Pin the helper return type narrowly (no
// `undefined`) so `exactOptionalPropertyTypes` accepts the assignment.
type RegistrationPromiseFn = Exclude<
  NonNullable<Parameters<typeof createShowTriggerNotifier>[0]>['registrationPromise'],
  undefined
>

function asRegistrationPromise(reg: FakeRegistration): RegistrationPromiseFn {
  return (async () => reg) as unknown as RegistrationPromiseFn
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
      registrationPromise: asRegistrationPromise(reg),
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
      registrationPromise: asRegistrationPromise(reg),
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
      registrationPromise: asRegistrationPromise(reg),
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
      registrationPromise: asRegistrationPromise(reg),
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
      registrationPromise: asRegistrationPromise(reg),
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

  it('closes cross-session orphans — OS holds tags the in-memory Set never saw', async () => {
    // Simulate a fresh tab where the OS already holds a notification
    // (e.g. for `wc2026-r16-03`) registered in a prior session that the
    // new notifier instance knows nothing about. The new plan does NOT
    // include that match (cancelled in the daily refresh). The orphan
    // MUST be closed; the same-tag in-plan entry MUST survive (replaced
    // via showNotification, not pre-closed).
    const reg = makeFakeRegistration({
      seedTags: ['wc2026-r16-03', 'wc2026-g-c-01'],
    })
    const notifier = createShowTriggerNotifier({
      registrationPromise: asRegistrationPromise(reg),
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([
      makeEntry({ matchId: 'g-c-01', fireAtMs: NOW + 60_000 }),
    ]) as unknown as Promise<void>)
    expect(reg.pending.map((p) => p.tag)).toEqual(['wc2026-g-c-01'])
  })

  it('boot scenario — empty plan + OS holds prior notifications closes all of ours', async () => {
    // The user closed the tab; the tournament got reshuffled; the new
    // plan would be empty (or the user revoked permission). All prior
    // notifications must be cleaned up.
    const reg = makeFakeRegistration({
      seedTags: ['wc2026-g-a-01', 'wc2026-g-b-02', 'wc2026-r32-05', 'wc2026-qf-1', 'wc2026-final'],
    })
    const notifier = createShowTriggerNotifier({
      registrationPromise: asRegistrationPromise(reg),
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([]) as unknown as Promise<void>)
    expect(reg.pending).toEqual([])
  })

  it('tag-prefix guard — leaves notifications from other code untouched', async () => {
    // Defensive: there is no other code on this origin today, but a
    // future feature using the same SW registration must not have its
    // notifications yanked by our cleanup pass.
    const reg = makeFakeRegistration({
      seedTags: ['wc2026-g-c-01', 'other-app-notif', 'wc2026-r32-01', 'analytics-ping'],
    })
    const notifier = createShowTriggerNotifier({
      registrationPromise: asRegistrationPromise(reg),
      trigger: (ts) => new TT(ts),
    })
    await (notifier.schedule([]) as unknown as Promise<void>)
    // Only the wc2026-* ones got closed; the foreign tags survive.
    expect(reg.pending.map((p) => p.tag).sort()).toEqual(['analytics-ping', 'other-app-notif'])
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
      registrationPromise: asRegistrationPromise(reg),
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
      registrationPromise: asRegistrationPromise(reg),
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

  it('cancelAll() with no own notifications in the OS closes nothing', async () => {
    // The OS-level enumeration is the source of truth now (cross-session
    // cleanup, see schedule()). With an empty registration, the pass is
    // still a query (to be safe — there could be cross-session orphans
    // we never armed in THIS session) but nothing matches the prefix,
    // so no `.close()` happens.
    const reg = makeFakeRegistration()
    const notifier = createShowTriggerNotifier({
      registrationPromise: asRegistrationPromise(reg),
      trigger: (ts) => new TT(ts),
    })
    await (notifier.cancelAll() as unknown as Promise<void>)
    expect(reg.getNotifications).toHaveBeenCalled()
    expect(reg.pending).toEqual([])
  })
})
