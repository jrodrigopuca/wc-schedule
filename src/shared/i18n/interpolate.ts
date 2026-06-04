// Minimal {placeholder} interpolation. No escaping, no nested expressions,
// no plural rules — by design. The full i18n surface for MVP is fewer than
// a dozen strings with simple substitution.

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}
