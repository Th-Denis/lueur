/**
 * Configuration Vitest de l'app web (tests unitaires).
 *
 * Pourquoi limiter aux fichiers `src/**\/*.test.ts` : les tests end-to-end du
 * dossier `e2e/` sont exécutés par Playwright, pas par Vitest.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
