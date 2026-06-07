import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We import lazily inside each test so `__resetNotificationsForTests` can
// pick up the current `Notification` stub. The composable is a module
// singleton; the initial state is read at module load.
async function loadUseNotifications(): Promise<
  typeof import('@/notifications/composables/useNotifications')
> {
  return import('@/notifications/composables/useNotifications')
}

function stubNotification(
  permission: NotificationPermission | undefined,
  requestPermissionImpl: () => Promise<NotificationPermission>,
): { requestPermission: ReturnType<typeof vi.fn> } {
  const requestPermission = vi.fn(requestPermissionImpl)
  if (permission === undefined) {
    // Explicit "no Notification at all" — `'Notification' in window` must be
    // false. Easiest way: leave the global unset by stubbing nothing here.
    return { requestPermission }
  }
  vi.stubGlobal('Notification', {
    permission,
    requestPermission,
  })
  return { requestPermission }
}

describe('useNotifications — initial permission state', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
  })

  it("is 'unsupported' when the Notification global is missing", async () => {
    // happy-dom does NOT install a `Notification` global by default. We
    // double-check by deleting any leftover from a sibling test, then
    // resetting the composable so it re-reads.
    // `vi.stubGlobal('Notification', undefined)` doesn't truly REMOVE the
    // property in happy-dom, so we use `delete` directly.
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as unknown as { Notification?: unknown }).Notification
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    expect(permission.value).toBe('unsupported')
  })

  it("maps native 'default' → 'idle'", async () => {
    stubNotification('default', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    expect(permission.value).toBe('idle')
  })

  it("maps native 'granted' → 'granted'", async () => {
    stubNotification('granted', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    expect(permission.value).toBe('granted')
  })

  it("maps native 'denied' → 'denied'", async () => {
    stubNotification('denied', () => Promise.resolve('denied'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    expect(permission.value).toBe('denied')
  })
})

describe('useNotifications — requestPermission() from idle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
  })

  it('idle → requesting → granted on user grant', async () => {
    // Use a deferred promise so we can observe the intermediate
    // 'requesting' state synchronously, before the prompt resolves.
    let resolveOutcome: (value: NotificationPermission) => void = () => {}
    const pending = new Promise<NotificationPermission>((res) => {
      resolveOutcome = res
    })
    stubNotification('default', () => pending)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()

    expect(permission.value).toBe('idle')
    const inFlight = requestPermission()
    expect(permission.value).toBe('requesting')
    resolveOutcome('granted')
    await inFlight
    expect(permission.value).toBe('granted')
  })

  it('idle → requesting → denied on user dismissal', async () => {
    let resolveOutcome: (value: NotificationPermission) => void = () => {}
    const pending = new Promise<NotificationPermission>((res) => {
      resolveOutcome = res
    })
    stubNotification('default', () => pending)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()

    expect(permission.value).toBe('idle')
    const inFlight = requestPermission()
    expect(permission.value).toBe('requesting')
    resolveOutcome('denied')
    await inFlight
    expect(permission.value).toBe('denied')
  })

  it('treats a thrown requestPermission() as a denial', async () => {
    stubNotification('default', () => Promise.reject(new Error('boom')))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()
    await requestPermission()
    expect(permission.value).toBe('denied')
  })
})

describe('useNotifications — no-op re-calls (spec §3 / AC-3)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
  })

  it('does NOT re-prompt when already denied', async () => {
    const { requestPermission: nativeFn } = stubNotification('denied', () =>
      Promise.resolve('granted'),
    )
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()
    expect(permission.value).toBe('denied')
    await requestPermission()
    expect(permission.value).toBe('denied')
    expect(nativeFn).not.toHaveBeenCalled()
  })

  it('does NOT re-prompt when already granted', async () => {
    const { requestPermission: nativeFn } = stubNotification('granted', () =>
      Promise.resolve('denied'),
    )
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()
    expect(permission.value).toBe('granted')
    await requestPermission()
    expect(permission.value).toBe('granted')
    expect(nativeFn).not.toHaveBeenCalled()
  })

  it("does NOT call the native API when 'unsupported'", async () => {
    // Same deletion dance as the unsupported-init test above.
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as unknown as { Notification?: unknown }).Notification
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()
    expect(permission.value).toBe('unsupported')
    // requestPermission MUST resolve cleanly (no throw) AND must not flip
    // the state — there's no Notification global to call.
    await expect(requestPermission()).resolves.toBeUndefined()
    expect(permission.value).toBe('unsupported')
  })

  it("re-call while 'requesting' does not issue a second prompt", async () => {
    // The native fn returns a never-resolving promise so we can observe
    // the 'requesting' state and confirm a second call is a no-op.
    let resolveOutcome: (value: NotificationPermission) => void = () => {}
    const pending = new Promise<NotificationPermission>((res) => {
      resolveOutcome = res
    })
    const { requestPermission: nativeFn } = stubNotification('default', () => pending)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission, requestPermission } = mod.useNotifications()

    expect(permission.value).toBe('idle')
    const first = requestPermission()
    expect(permission.value).toBe('requesting')
    const second = requestPermission()
    // Both calls return promises; the second short-circuits.
    expect(nativeFn).toHaveBeenCalledTimes(1)

    resolveOutcome('granted')
    await Promise.all([first, second])
    expect(permission.value).toBe('granted')
  })
})

// Module-level mock for the notifier picker. `vi.mock` is HOISTED to
// the top of the file, so we cannot reference outer variables from
// inside the factory — instead we expose the stub from the mock module
// itself and re-import to inspect calls.
//
// Phase 9b: the picker now also exposes `isShowTriggerSupported`. The
// mock returns `true` by default so tests that DON'T care about the
// detection path inherit the "supported" behavior; tests that DO care
// re-import `__stubs.isShowTriggerSupported` and flip it.
vi.mock('@/notifications/adapters/pick-notifier', () => {
  const schedule = vi.fn()
  const cancel = vi.fn()
  const cancelAll = vi.fn()
  const isShowTriggerSupported = vi.fn(() => true)
  return {
    isShowTriggerSupported,
    pickNotifier: vi.fn(() => ({
      name: 'mock',
      schedule,
      cancel,
      cancelAll,
    })),
    // Test-only escape hatch: the test file pulls these back via a
    // direct re-import to assert delegation.
    __stubs: { schedule, cancel, cancelAll, isShowTriggerSupported },
  }
})

async function loadPickerMockStubs(): Promise<{
  schedule: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  cancelAll: ReturnType<typeof vi.fn>
  isShowTriggerSupported: ReturnType<typeof vi.fn>
}> {
  const mocked = (await import('@/notifications/adapters/pick-notifier')) as unknown as {
    __stubs: {
      schedule: ReturnType<typeof vi.fn>
      cancel: ReturnType<typeof vi.fn>
      cancelAll: ReturnType<typeof vi.fn>
      isShowTriggerSupported: ReturnType<typeof vi.fn>
    }
  }
  return mocked.__stubs
}

describe('useNotifications — Phase 9b showTrigger gating', () => {
  // Phase 9b LOCKED decision (design.md §12.2): production ships only
  // the showTrigger strategy. When it's missing the composable reports
  // `'unsupported'` and the CTA never renders. The mock defaults to
  // "supported"; flip via `__stubs.isShowTriggerSupported`.
  beforeEach(async () => {
    vi.unstubAllGlobals()
    const stubs = await loadPickerMockStubs()
    stubs.isShowTriggerSupported.mockReturnValue(true)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const stubs = await loadPickerMockStubs()
    // Re-pin default for the next test so the global mock stays
    // deterministic regardless of test ordering.
    stubs.isShowTriggerSupported.mockReturnValue(true)
  })

  it("is 'unsupported' when showTrigger is NOT supported even if Notification.permission === 'default'", async () => {
    stubNotification('default', () => Promise.resolve('granted'))
    const stubs = await loadPickerMockStubs()
    stubs.isShowTriggerSupported.mockReturnValue(false)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    // No reliable delivery path → entire feature reported as unsupported
    // → EnableNotificationsButton renders nothing.
    expect(permission.value).toBe('unsupported')
  })

  it("is 'idle' when showTrigger IS supported and Notification.permission === 'default'", async () => {
    stubNotification('default', () => Promise.resolve('granted'))
    const stubs = await loadPickerMockStubs()
    stubs.isShowTriggerSupported.mockReturnValue(true)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    const { permission } = mod.useNotifications()
    expect(permission.value).toBe('idle')
  })

  it("delegates schedule() to the show-trigger notifier when supported AND 'granted'", async () => {
    stubNotification('granted', () => Promise.resolve('granted'))
    const stubs = await loadPickerMockStubs()
    stubs.isShowTriggerSupported.mockReturnValue(true)
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const { schedule } = mod.useNotifications()
    schedule([])
    expect(stubs.schedule).toHaveBeenCalledTimes(1)
  })
})

describe('useNotifications — schedule() + cancelAllScheduled()', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals()
    const stubs = await loadPickerMockStubs()
    stubs.schedule.mockClear()
    stubs.cancel.mockClear()
    stubs.cancelAll.mockClear()
    stubs.isShowTriggerSupported.mockReturnValue(true)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
  })

  it("schedule() is a no-op when permission is not 'granted'", async () => {
    stubNotification('default', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const stubs = await loadPickerMockStubs()
    const { schedule } = mod.useNotifications()
    schedule([])
    expect(stubs.schedule).not.toHaveBeenCalled()
  })

  it("schedule() delegates to the picked notifier when permission is 'granted'", async () => {
    stubNotification('granted', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const stubs = await loadPickerMockStubs()
    const { schedule } = mod.useNotifications()
    const entries = [
      {
        matchId: 'm-1',
        fireAtMs: Date.parse('2026-06-13T17:00:00Z'),
        match: {
          id: 'm-1',
          utcKickoff: '2026-06-13T17:15:00Z',
          stage: 'group' as const,
          teamA: { iso: 'ar', name: 'Argentina' },
          teamB: { iso: 'br', name: 'Brasil' },
        },
      },
    ]
    schedule(entries)
    expect(stubs.schedule).toHaveBeenCalledTimes(1)
    expect(stubs.schedule).toHaveBeenCalledWith(entries)
  })

  it('cancelAllScheduled() calls cancelAll on the notifier when one exists', async () => {
    stubNotification('granted', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const stubs = await loadPickerMockStubs()
    const { schedule, cancelAllScheduled } = mod.useNotifications()
    // Lazy-construct via a first schedule() call.
    schedule([])
    cancelAllScheduled()
    expect(stubs.cancelAll).toHaveBeenCalledTimes(1)
  })

  it('cancelAllScheduled() is a no-op when no notifier was constructed', async () => {
    stubNotification('default', () => Promise.resolve('granted'))
    const mod = await loadUseNotifications()
    mod.__resetNotificationsForTests()
    mod.__resetNotifierForTests()
    const stubs = await loadPickerMockStubs()
    const { cancelAllScheduled } = mod.useNotifications()
    // Permission is 'idle' → schedule() never ran → notifier === null.
    // cancelAllScheduled() must still resolve cleanly.
    expect(() => cancelAllScheduled()).not.toThrow()
    expect(stubs.cancelAll).not.toHaveBeenCalled()
  })
})
