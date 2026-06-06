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
