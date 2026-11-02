import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

// Reads package.json at config time so the About panel can never drift from the
// real version. Kept as a runtime call rather than an import.meta.env value so
// the value stays correct no matter who last edited the two files.
const pkg = createRequire(import.meta.url)('./package.json') as { version: string };

// Electron logs a security warning when the renderer ships without a CSP.
// 'unsafe-inline' stays in style-src because the app sets element styles from
// JS and Framer Motion injects them at runtime; dev additionally needs eval +
// websockets for HMR.
function contentSecurityPolicy(isDev: boolean): string {
  // global.css pulls Inter from Google Fonts and the Geist faces from jsDelivr,
  // so both origins have to stay allowed or the UI falls back to system fonts.
  const FONT_HOSTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'];
  const directives = [
    "default-src 'self'",
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    `style-src 'self' 'unsafe-inline' ${FONT_HOSTS.join(' ')}`,
    // Artwork and backgrounds come from remote hosts, blob: previews, and the
    // local-video:// scheme for picked videos.
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http: local-video:",
    `font-src 'self' data: ${FONT_HOSTS.join(' ')}`,
    `connect-src 'self' https: http:${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'"
  ];
  return directives.join('; ');
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    // The packaged app is loaded over file:// by Electron, so every emitted
    // asset reference must be RELATIVE. Vite's default base ('/') produces
    // `/assets/index-<hash>.js`, which the file:// loader resolves against the
    // drive root (C:/assets/...) and renders a blank window.
    base: isDev ? '/' : './',
    plugins: [
      react(),
      {
        name: 'mypresence-csp',
        transformIndexHtml(html) {
          const tag = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(isDev)}" />`;
          return html.replace('</head>', `${tag}\n  </head>`);
        }
      }
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true
    },
    // Electron opens DevTools in dev; don't let Vite's watcher clear the screen.
    clearScreen: false,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Electron 32 ships Chromium 128 — no need for the newest syntax.
      target: 'chrome128',
      sourcemap: false,
      chunkSizeWarningLimit: 900
    }
  };
});