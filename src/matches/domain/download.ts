// Browser-side download trigger for arbitrary text content. Kept domain-
// adjacent (not in `shared/`) because today the only caller is the ICS
// export flow; if a second feature ever wants to ship a Blob download we
// can lift this to `src/shared/dom/`.
//
// Defensive: in SSR / Node / test envs without `URL.createObjectURL` the
// call is a silent no-op. We do NOT throw — the caller's UX is "user
// clicked, nothing visible happened" which is preferable to a runtime
// error in a sandboxed environment.

export function triggerIcsDownload(content: string, filename: string): void {
  if (typeof window === 'undefined') return
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return
  if (typeof document === 'undefined') return

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(url)
}
