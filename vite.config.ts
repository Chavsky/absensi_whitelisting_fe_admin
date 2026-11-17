import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const backendTarget = 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
            '/api': {
              target: backendTarget,
              changeOrigin: true,
              secure: false,
              configure: (proxy, _options) => {
                proxy.on('error', (err, _req, res) => {
                  console.warn(`[vite proxy error] ${err.message}`);
                  if (res && 'writeHead' in res && !res.headersSent) {
                    res.writeHead(503, {'Content-Type': 'application/json'});
                    res.end(
                      JSON.stringify({
                        success: false,
                        message: `Backend sistem absensi di ${backendTarget} tidak merespons (${err.message}). Pastikan server Express/PostgreSQL aktif.`,
                      })
                    );
                  }
                });
      },
            },
          },
    },
  };
});

