import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Load every var from .env / .env.local (empty prefix = no filter).
  // Needed for RLS tests to see NEXT_PUBLIC_SUPABASE_* and for any future
  // server-side integration test that wants SUPABASE_SERVICE_ROLE_KEY.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
      exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
      env,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
