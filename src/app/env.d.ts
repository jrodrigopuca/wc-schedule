/// <reference types="vite/client" />

// `VITE_DATA_SOURCE` selects the runtime data layer at build time
// (see openspec data-source.md §3, design.md §4.2):
// - `"manual"`: the bundled fixture is the ONLY source — no network I/O.
// - `"remote"`: the full fallback chain runs — `[remote, history, manual]`.
//
// Build-time selection is a hard requirement; the app MUST NOT silently
// switch modes at runtime based on connectivity.
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE: 'manual' | 'remote'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
