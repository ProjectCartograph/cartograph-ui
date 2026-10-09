import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // A test beside a route is not a route. Without this the generator
    // warns on every build and every test run that the file exports no
    // Route, which trains everyone to read past its warnings.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '__tests__',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Each worker builds jsdom once and runs every file in a fresh VM
    // context of it, so files stay isolated without paying for a new
    // environment each: on two workers, 37 s became 11 s. Sharing one
    // context (isolate: false) leaks module state and fails 65 tests.
    pool: 'vmThreads',
  },
})
