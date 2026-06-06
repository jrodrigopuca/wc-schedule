import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EnableNotificationsButton from '@/notifications/ui/EnableNotificationsButton.vue'
import {
  __resetNotificationsForTests,
  useNotifications,
} from '@/notifications/composables/useNotifications'
import { useI18n } from '@/shared/i18n/useI18n'

function stubNotification(
  permission: NotificationPermission | undefined,
  requestPermissionImpl: () => Promise<NotificationPermission>,
): { requestPermission: ReturnType<typeof vi.fn> } {
  const requestPermission = vi.fn(requestPermissionImpl)
  if (permission === undefined) {
    return { requestPermission }
  }
  vi.stubGlobal('Notification', {
    permission,
    requestPermission,
  })
  return { requestPermission }
}

describe('EnableNotificationsButton', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
    __resetNotificationsForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    useI18n().clearOverride()
    __resetNotificationsForTests()
  })

  it("renders nothing when permission is 'unsupported'", () => {
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as unknown as { Notification?: unknown }).Notification
    __resetNotificationsForTests()
    const wrapper = mount(EnableNotificationsButton)
    expect(useNotifications().permission.value).toBe('unsupported')
    expect(wrapper.text()).toBe('')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders the idle CTA and invokes requestPermission on click', async () => {
    let resolveOutcome: (v: NotificationPermission) => void = () => {}
    const pending = new Promise<NotificationPermission>((res) => {
      resolveOutcome = res
    })
    const { requestPermission: nativeFn } = stubNotification('default', () => pending)
    __resetNotificationsForTests()
    const wrapper = mount(EnableNotificationsButton)
    expect(wrapper.text()).toContain('Avisame 15 min antes')
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    expect(nativeFn).toHaveBeenCalledTimes(1)

    resolveOutcome('granted')
    await flushPromises()
  })

  it('renders the requesting label with a disabled button while the prompt is open', async () => {
    let resolveOutcome: (v: NotificationPermission) => void = () => {}
    const pending = new Promise<NotificationPermission>((res) => {
      resolveOutcome = res
    })
    stubNotification('default', () => pending)
    __resetNotificationsForTests()
    const wrapper = mount(EnableNotificationsButton)
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(useNotifications().permission.value).toBe('requesting')
    expect(wrapper.text()).toContain('Solicitando permiso')
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()

    resolveOutcome('granted')
    await flushPromises()
  })

  it("renders the calm confirmation pill when permission is 'granted'", () => {
    stubNotification('granted', () => Promise.resolve('granted'))
    __resetNotificationsForTests()
    const wrapper = mount(EnableNotificationsButton)
    expect(wrapper.text()).toContain('Avisos activos')
    // Not a button — the granted state MUST NOT be re-clickable.
    expect(wrapper.find('button').exists()).toBe(false)
    // aria-live for assistive announcement of the new state.
    expect(wrapper.find('[aria-live="polite"]').exists()).toBe(true)
  })

  it("renders title + hint with NO interactive button when 'denied'", () => {
    stubNotification('denied', () => Promise.resolve('denied'))
    __resetNotificationsForTests()
    const wrapper = mount(EnableNotificationsButton)
    expect(wrapper.text()).toContain('Avisos bloqueados')
    expect(wrapper.text()).toContain('Activá los avisos del navegador para recibirlos')
    // Browsers permanently deny after two rejections — we MUST NOT tempt
    // the user with a re-clickable button.
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
