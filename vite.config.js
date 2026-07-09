import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// SmartLake 2.0 — Vite konfiguratsiyasi
//
// Ikki sahifali (multi-page) qurilma:
//   • index.html  -> Fermer ilovasi (keyinchalik Capacitor orqali APK)
//   • admin.html  -> Admin panel (faqat web)
//
// Ikkalasi ham `src/` ichidagi bir xil `core/` va `shared/` modullaridan
// foydalanadi, shuning uchun bitta build va bitta bog'liqlik daraxti yetarli.
export default defineConfig({
  root: '.',

  // Muhit o'zgaruvchilari faqat VITE_ prefiksi bilan mijoz kodiga chiqadi.
  envPrefix: 'VITE_',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Eski WebView (Android APK) uchun keng moslik.
    target: 'es2019',
    sourcemap: false,
    rollupOptions: {
      input: {
        farmer: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },

  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: 'all',
    open: false,
  },

  // Unit testlar Vitest orqali (Vite bilan bir xil konfiguratsiya).
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
  },
});
