/**
 * Configuration Vitest de packages/crypto.
 *
 * Pourquoi des seuils de couverture à 100 % : la spec (section 8) exige une
 * couverture « proche de 100 % » pour la crypto. On part de 100 % et on
 * n'abaissera un seuil que de façon justifiée et documentée.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
