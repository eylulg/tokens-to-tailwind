/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { themeInitScript } from '@eylulg/ui/theme-script';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/tokens-to-tailwind/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'theme-init',
      transformIndexHtml: () => [
        { tag: 'script', children: themeInitScript, injectTo: 'head-prepend' },
      ],
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (
            /node_modules\/(@react-aria|@react-stately|react-aria|react-aria-components|@internationalized)\//.test(
              id,
            )
          )
            return 'react-aria';
          return undefined;
        },
      },
    },
  },
  server: {
    // The file: dependency is a symlink to ../ui, outside the project root.
    fs: { allow: ['.', fileURLToPath(new URL('../ui', import.meta.url))] },
  },
  resolve: {
    // The linked library has its own node_modules; one copy of React, React Aria and lucide must run.
    dedupe: ['react', 'react-dom', 'react-aria-components', 'lucide-react'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // theme.css is read with ?raw by the preview, so it must not be stubbed.
    css: { include: [/theme\.css/] },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
