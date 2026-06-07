import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Match } from '@/matches/domain/match'
import AddToCalendarButton from '@/matches/ui/AddToCalendarButton.vue'
import { useI18n } from '@/shared/i18n/useI18n'
import { __resetClockForTests, __setClockForTests } from '@/shared/time/now'

const NOW = Date.parse('2026-06-14T09:30:45Z')

const baseMatch: Match = {
  id: 'wc2026-g-c-01',
  utcKickoff: '2026-06-25T19:00:00Z',
  status: 'scheduled',
  stage: 'group',
  group: 'C',
  teamA: { iso: 'ar', name: 'Argentina' },
  teamB: { iso: 'ma', name: 'Marruecos' },
  venue: { city: 'Los Angeles', country: 'United States' },
}

describe('AddToCalendarButton', () => {
  beforeEach(() => {
    useI18n().setLocale('es')
    localStorage.removeItem('wc-locale')
    __setClockForTests(() => NOW)
  })

  afterEach(() => {
    __resetClockForTests()
    useI18n().clearOverride()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders a button with the Spanish aria-label that names both teams', () => {
    const wrapper = mount(AddToCalendarButton, { props: { match: baseMatch } })
    const button = wrapper.find('button')
    const label = button.attributes('aria-label') ?? ''
    expect(label).toContain('Agregar al calendario')
    expect(label).toContain('Argentina')
    expect(label).toContain('Marruecos')
  })

  it('on click, triggers the Blob download flow with a localized SUMMARY', () => {
    const SENTINEL = 'blob:download-sentinel'
    const createObjectURL = vi.fn(() => SENTINEL)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = clickSpy
      }
      return el
    })

    const wrapper = mount(AddToCalendarButton, { props: { match: baseMatch } })
    void wrapper.find('button').trigger('click')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('text/calendar;charset=utf-8')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(SENTINEL)
  })

  it('writes the resolved ES team names into the ICS SUMMARY', async () => {
    let capturedIcs = ''
    const createObjectURL = vi.fn((blob: Blob): string => {
      void (async (): Promise<void> => {
        capturedIcs = await blob.text()
      })()
      return 'blob:capture'
    })
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = vi.fn()
      }
      return el
    })

    const wrapper = mount(AddToCalendarButton, { props: { match: baseMatch } })
    void wrapper.find('button').trigger('click')

    // Allow the queued microtask from `blob.text()` to settle.
    await Promise.resolve()
    await Promise.resolve()

    expect(capturedIcs).toContain('SUMMARY:Argentina vs Marruecos')
    expect(capturedIcs).toContain('DESCRIPTION:Fase de grupos · Grupo C · Mundial 2026')
  })

  it('sets a filename of the form wc2026-{a}-vs-{b}-{YYYY-MM-DD}.ics', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    })

    let capturedDownload = ''
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = vi.fn(() => {
          capturedDownload = el.download
        })
      }
      return el
    })

    const wrapper = mount(AddToCalendarButton, { props: { match: baseMatch } })
    void wrapper.find('button').trigger('click')

    expect(capturedDownload).toBe('wc2026-ar-vs-ma-2026-06-25.ics')
  })
})
