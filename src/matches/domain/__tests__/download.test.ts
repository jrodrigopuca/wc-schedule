import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerIcsDownload } from '@/matches/domain/download'

describe('triggerIcsDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('creates a Blob URL, sets it on an anchor, clicks, and revokes the URL', () => {
    const SENTINEL = 'blob:sentinel-url'
    const createObjectURL = vi.fn(() => SENTINEL)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const clickSpy = vi.fn()
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    // Patch the anchor's `click` so we can assert it was invoked and avoid
    // happy-dom following the href.
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag) as HTMLAnchorElement
      if (tag === 'a') {
        el.click = clickSpy
      }
      return el
    })

    triggerIcsDownload('FAKE-ICS-BODY', 'wc2026.ics')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('text/calendar;charset=utf-8')

    expect(appendSpy).toHaveBeenCalledTimes(1)
    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement
    expect(anchor.href).toBe(SENTINEL)
    expect(anchor.download).toBe('wc2026.ics')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(SENTINEL)
  })

  it('is a silent no-op when URL.createObjectURL is missing', () => {
    vi.stubGlobal('URL', {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    expect(() => {
      triggerIcsDownload('whatever', 'file.ics')
    }).not.toThrow()

    expect(appendSpy).not.toHaveBeenCalled()
  })
})
