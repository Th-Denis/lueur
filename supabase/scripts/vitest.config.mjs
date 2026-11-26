/**
 * Configuration Vitest des scripts de base de données (supabase/scripts).
 *
 * Seules les fonctions pures sont testées ici ; le script complet
 * (check-rollbacks.mjs) est exécuté en CI contre la base locale.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['**/*.test.mjs'],
  },
});
