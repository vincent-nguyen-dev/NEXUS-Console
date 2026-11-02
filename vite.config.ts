import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm run dev` only: the ops feed is fetched same-origin and forwarded here, because Northstar's
  // CORS allows only the deployed origin (see FEED_BASE in src/lib/api.ts). Builds call Render directly.
  server: {
    proxy: {
      '/api/ops': { target: 'https://northstar-digital-api.onrender.com', changeOrigin: true },
    },
  },
  test: {
    // src/lib is pure and DOM-free; component tests (if any) opt into a DOM per file.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
