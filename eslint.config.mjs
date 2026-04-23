import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

/**
 * ESLint flat config — enforces:
 *   1. Next.js core-web-vitals + TypeScript defaults.
 *   2. Constitution Principle II: no cross-feature imports.
 *      A file in features/a/** cannot import from features/b/**.
 *      lib/** can only import from lib/** or types/**.
 */
const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'types/database.ts',
  ]),
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'app/**' },
        { type: 'feature', pattern: 'features/*/**', capture: ['feature'] },
        { type: 'lib', pattern: 'lib/**' },
        { type: 'types', pattern: 'types/**' },
        { type: 'tests', pattern: 'tests/**' },
      ],
      'boundaries/ignore': ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['app', 'feature', 'lib', 'types'] },
            {
              from: [['feature', { feature: '${feature}' }]],
              allow: [['feature', { feature: '${feature}' }], 'lib', 'types'],
            },
            { from: 'lib', allow: ['lib', 'types'] },
            { from: 'tests', allow: ['app', 'feature', 'lib', 'types'] },
          ],
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);

export default eslintConfig;
