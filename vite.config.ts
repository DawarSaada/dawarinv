import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
) as { version?: string };

// Note: no secrets are injected into the bundle. Client-visible values come from
// VITE_* variables and are validated in config.ts. Server secrets (Gemini API key,
// VAPID private key) live in Supabase function secrets.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Registration happens explicitly in index.tsx so we can surface update state.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg', 'robots.txt'],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5_000_000,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      manifest: {
        name: 'Dawar Saada Inventory',
        short_name: 'DawarSaada',
        description: 'Inventory management for Warehouse and Mammal units.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ea580c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Ship readable, cache-friendly output; source maps are intentionally off for
    // production builds to avoid publishing the full source of this internal app.
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Libraries imported dynamically must stay in their own async chunk;
          // forcing them into a manual chunk would inline them in the initial load.
          if (/[\\/]node_modules[\\/]html5-qrcode[\\/]/.test(id)) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/](@supabase|@tanstack)[\\/]/.test(id)) return 'data-vendor';
          if (/[\\/]node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor)[\\/]/.test(id)) return 'charts-vendor';
          if (/[\\/]node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'pdfjs-vendor';
          if (/[\\/]node_modules[\\/](jspdf|jspdf-autotable|qrcode|qrcode\.react|react-barcode)[\\/]/.test(id))
            return 'pdf-vendor';
          if (/[\\/]node_modules[\\/]xlsx[\\/]/.test(id)) return 'spreadsheet-vendor';
          return 'vendor';
        },
      },
    },
  },
});
