import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // `server-only` werpt buiten een servercomponent; in tests niet nodig.
      'server-only': path.resolve(import.meta.dirname, 'test/server-only.ts'),
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
