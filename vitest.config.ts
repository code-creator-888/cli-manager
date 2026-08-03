import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'shared/**/*.test.ts'],
    exclude: ['dist/**', 'dist-electron/**', 'release/**', 'node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
