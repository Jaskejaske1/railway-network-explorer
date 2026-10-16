import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['localhost', '127.0.0.1'] }
});
