import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Deploy target: https://jrodrigopuca.github.io/wc-schedule/
// `base` is fixed to the repo path so all assets resolve under that prefix
// when served from GitHub Pages. `start_url` / `scope` mirror it so the
// installed PWA opens at the deploy root and stays scoped to it.
const REPO_BASE = '/wc-schedule/'

// Dev-only redirect: in production the host serves from the repo path
// natively (GH Pages prefix). Locally, hitting `http://localhost:5173/`
// would otherwise 404 because the app is mounted under the base. We
// redirect bare root visits to the base path so devs can hit "/" and
// land in the app without remembering the prefix.
function devRootRedirect(): PluginOption {
  return {
    name: 'dev-root-redirect',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url === '') {
          res.writeHead(302, { Location: REPO_BASE })
          res.end()
          return
        }
        next()
      })
    },
  }
}

// Theme color matches the brand-mark accent (`var(--accent)` in light
// mode). This drives the OS-level install splash + the iOS/Android
// status-bar tint when the PWA is open in standalone mode.
const THEME_COLOR = '#16A34A'

// Background color used by the install splash screen while the JS boots.
// Kept neutral-dark so dark-mode users don't get flashed with green.
const BACKGROUND_COLOR = '#16161D'

export default defineConfig({
  base: REPO_BASE,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    devRootRedirect(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'WC Schedule — Mundial 2026',
        short_name: 'Mundial 2026',
        description: 'Calendario y avisos del Mundial 2026',
        lang: 'es',
        start_url: REPO_BASE,
        scope: REPO_BASE,
        display: 'standalone',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
