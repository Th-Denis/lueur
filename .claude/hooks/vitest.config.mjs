/**
 * Configuration Vitest des hooks Claude Code (.claude/hooks).
 *
 * Pourquoi tester les hooks : ce sont des garde-fous de sécurité (blocage des
 * secrets, confirmation des commandes destructrices). Un garde-fou non testé
 * peut laisser passer ce qu'il est censé bloquer sans que personne ne le voie.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['**/*.test.mjs'],
  },
});
