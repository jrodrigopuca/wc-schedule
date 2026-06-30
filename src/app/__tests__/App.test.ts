import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '@/App.vue'
import { useI18n } from '@/shared/i18n/useI18n'

vi.mock('@/app/MainView.vue', () => ({
  default: { template: '<div data-view="main">Main</div>' },
}))

vi.mock('@/app/PreviewView.vue', () => ({
  default: { template: '<div data-view="preview">Preview</div>' },
}))

vi.mock('@/app/BracketView.vue', () => ({
  default: { template: '<div data-view="bracket">Bracket</div>' },
}))

vi.mock('@/shared/ui/LocaleToggle.vue', () => ({
  default: { template: '<button type="button">Locale</button>' },
}))

vi.mock('@/shared/ui/ThemeToggle.vue', () => ({
  default: { template: '<button type="button">Theme</button>' },
}))

describe('App shell routing', () => {
  beforeEach(() => {
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useI18n().setLocale('es')
  })

  afterEach(() => {
    window.location.hash = ''
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    useI18n().clearOverride()
  })

  it('renders the main view in the compact shell by default', async () => {
    const wrapper = mount(App)

    wrapper.get('[data-view="main"]')
    expect(wrapper.attributes('data-route')).toBe('main')
    expect(wrapper.get('[data-app-main]').attributes('data-shell-width')).toBe('compact')
  })

  it('renders the preview view without widening the shell', async () => {
    const wrapper = mount(App)
    window.location.hash = '#/preview'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    wrapper.get('[data-view="preview"]')
    expect(wrapper.attributes('data-route')).toBe('preview')
    expect(wrapper.get('[data-app-main]').attributes('data-shell-width')).toBe('compact')
  })

  it('renders the bracket view in the wide shell', async () => {
    const wrapper = mount(App)
    window.location.hash = '#/bracket'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    wrapper.get('[data-view="bracket"]')
    expect(wrapper.attributes('data-route')).toBe('bracket')
    expect(wrapper.get('[data-app-main]').attributes('data-shell-width')).toBe('wide')
  })
})
