import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Gemini is called through server/gemini-proxy.php now — no API key is ever
  // bundled into client code. Don't reintroduce a `define` here for it; that
  // `define` was exactly what shipped the key inside dist/assets/*.js before.
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy, slow-changing vendor code into its own cacheable
          // chunks instead of one ~1 MB blob that changes (and re-downloads)
          // on every app-code edit. Screens themselves are already
          // React.lazy-split per-route in App.tsx — this only addresses the
          // vendor portion of the remaining "index" chunk.
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['motion/react']
          }
        }
      }
    },
  };
});
