// PWA asset generator config. Consumed by `@vite-pwa/assets-generator`
// via `pnpm run generate:icons`.
//
// We use the `minimal-2023` preset which emits:
//   - transparent sizes 64, 192, 512 (named pwa-64x64.png, pwa-192x192.png,
//     pwa-512x512.png) — these are the manifest icons referenced in
//     vite.config.ts.
//   - a maskable 512 (named maskable-icon-512x512.png) — referenced as the
//     `any maskable` entry in the manifest.
//   - an apple-touch-icon at 180 (named apple-touch-icon-180x180.png) —
//     referenced from a <link rel="apple-touch-icon"> in index.html.
//   - a favicon.ico generated from the 48px transparent variant.
//
// The source SVG lives at `public/icon-source.svg` and outputs are written
// alongside it (relative to `images`), which lands them in `public/` so the
// built dist serves them at the deploy root.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon-source.svg'],
  // The PWA manifest in vite.config.ts already references the generated
  // PNGs by name, so we don't need the generator to print a manifest entry
  // suggestion on every run.
  manifestIconsEntry: false,
})
