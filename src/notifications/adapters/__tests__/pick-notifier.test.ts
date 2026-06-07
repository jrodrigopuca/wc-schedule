import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isShowTriggerSupported, pickNotifier } from '@/notifications/adapters/pick-notifier'

// Phase 9b probe surface (design.md §8 / §12.2):
//
//   `Notification`               on `window`
//   `'showTrigger' in Notification.prototype`
//   `serviceWorker`              on `window.navigator`
//   `TimestampTrigger`           globally constructible
//
// Stripping any single condition MUST collapse the picker to `null`,
// which the composable interprets as `'unsupported'`. The CTA never
// renders. No half-broken foreground fallback in production.

// Capture clean baselines so each test restores precisely what it
// touched — happy-dom shares the same `window` instance across tests.
const ORIGINAL_NOTIFICATION = (globalThis as { Notification?: unknown }).Notification
const ORIGINAL_TIMESTAMP_TRIGGER = (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger

function installShowTriggerStubs(): void {
  // Stub a Notification constructor whose prototype carries the
  // `showTrigger` property — that's the canonical detection surface.
  class FakeNotification {}
  Object.defineProperty(FakeNotification.prototype, 'showTrigger', {
    value: null,
    configurable: true,
  })
  vi.stubGlobal('Notification', FakeNotification)
  // Inject the trigger constructor. `erasableSyntaxOnly` forbids
  // parameter properties — assign by hand.
  class FakeTimestampTrigger {
    public ts: number
    constructor(ts: number) {
      this.ts = ts
    }
  }
  vi.stubGlobal('TimestampTrigger', FakeTimestampTrigger)
  // Ensure navigator.serviceWorker exists; happy-dom doesn't ship it by
  // default. We only care that the property is present, the picker
  // never invokes it.
  if (!('serviceWorker' in window.navigator)) {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {},
      configurable: true,
    })
  }
}

function restoreOriginals(): void {
  vi.unstubAllGlobals()
  if (ORIGINAL_NOTIFICATION === undefined) {
    delete (globalThis as { Notification?: unknown }).Notification
  } else {
    ;(globalThis as { Notification?: unknown }).Notification = ORIGINAL_NOTIFICATION
  }
  if (ORIGINAL_TIMESTAMP_TRIGGER === undefined) {
    delete (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger
  } else {
    ;(globalThis as { TimestampTrigger?: unknown }).TimestampTrigger = ORIGINAL_TIMESTAMP_TRIGGER
  }
}

describe('isShowTriggerSupported', () => {
  beforeEach(() => {
    restoreOriginals()
  })

  afterEach(() => {
    restoreOriginals()
  })

  it('returns true when all four probes pass', () => {
    installShowTriggerStubs()
    expect(isShowTriggerSupported()).toBe(true)
  })

  it('returns false when Notification global is missing', () => {
    // Set up everything else THEN remove Notification.
    installShowTriggerStubs()
    vi.stubGlobal('Notification', undefined)
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as unknown as { Notification?: unknown }).Notification
    expect(isShowTriggerSupported()).toBe(false)
  })

  it("returns false when 'showTrigger' is not on Notification.prototype", () => {
    // Notification present, but its prototype lacks the property.
    class NotificationWithoutTrigger {}
    vi.stubGlobal('Notification', NotificationWithoutTrigger)
    class FakeTimestampTrigger {
      public ts: number
      constructor(ts: number) {
        this.ts = ts
      }
    }
    vi.stubGlobal('TimestampTrigger', FakeTimestampTrigger)
    if (!('serviceWorker' in window.navigator)) {
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: {},
        configurable: true,
      })
    }
    expect(isShowTriggerSupported()).toBe(false)
  })

  it('returns false when navigator.serviceWorker is missing', () => {
    installShowTriggerStubs()
    // Yank the SW property — `defineProperty` to non-existence is the
    // only reliable removal across DOM impls.
    delete (window.navigator as unknown as { serviceWorker?: unknown }).serviceWorker
    expect(isShowTriggerSupported()).toBe(false)
  })

  it('returns false when TimestampTrigger constructor is missing', () => {
    installShowTriggerStubs()
    vi.stubGlobal('TimestampTrigger', undefined)
    delete (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger
    expect(isShowTriggerSupported()).toBe(false)
  })
})

describe('pickNotifier — Phase 9b', () => {
  beforeEach(() => {
    restoreOriginals()
  })

  afterEach(() => {
    restoreOriginals()
  })

  it("returns the show-trigger notifier when supported (name === 'show-trigger')", () => {
    installShowTriggerStubs()
    const notifier = pickNotifier()
    expect(notifier).not.toBeNull()
    expect(notifier?.name).toBe('show-trigger')
  })

  it('returns null when showTrigger is missing — no foreground fallback in production', () => {
    // No stubs installed → showTrigger probe fails → null.
    expect(pickNotifier()).toBeNull()
  })

  it('returns null when Notification is missing', () => {
    installShowTriggerStubs()
    vi.stubGlobal('Notification', undefined)
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as unknown as { Notification?: unknown }).Notification
    expect(pickNotifier()).toBeNull()
  })

  it('returns null when navigator.serviceWorker is missing', () => {
    installShowTriggerStubs()
    delete (window.navigator as unknown as { serviceWorker?: unknown }).serviceWorker
    expect(pickNotifier()).toBeNull()
  })
})
