// Vite globs the bundled flag SVGs at build time and returns hashed URLs.
// Unknown ISO codes return null so the UI can render a neutral placeholder.

const flagModules = import.meta.glob<string>('./*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function resolveFlag(iso: string): string | null {
  const key = `./${iso.toLowerCase()}.svg`
  return flagModules[key] ?? null
}
