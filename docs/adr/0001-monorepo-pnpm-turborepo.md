# 0001. Monorepo pnpm et Turborepo, cryptographie isolée

- Statut : accepté
- Date : 2026-11-26

## Contexte

Lueur a une application web (Next.js) et, après la bêta, une application mobile (Expo). Les deux
partagent la cryptographie, les types, les schémas de validation et le client API. Le mobile doit
pouvoir réutiliser tout le code partageable sans réécriture (specs, section 9). Le projet est
développé avec Claude Code et doit rester facile à reprendre par un développeur.

## Décision

- Un seul dépôt, espaces de travail **pnpm** et orchestration **Turborepo** (cache des tâches).
- `apps/web`, `apps/mobile` : applications ; `packages/crypto`, `packages/core` : code partagé,
  consommé directement en TypeScript (champ `exports` vers `src/`, sans étape de build).
- **Toute la cryptographie dans `packages/crypto`**, et uniquement là : une règle ESLint interdit
  ailleurs l'import de `libsodium*`, `crypto`, `node:crypto`, `tweetnacl`, `crypto-js`,
  `expo-crypto` et l'accès à `globalThis.crypto` / `window.crypto`.
- Versions communes déclarées une fois dans le catalogue de `pnpm-workspace.yaml`.

## Alternatives écartées

- **Dépôts séparés** : duplication du code partagé, versions désynchronisées entre web et mobile.
- **Nx** : plus puissant, mais plus de configuration et de concepts pour un projet de cette taille.
- **npm ou Yarn workspaces** : pas de catalogue de versions ni de politiques de chaîne
  d'approvisionnement équivalentes à celles de pnpm (voir ADR 0002).

## Conséquences

- Une modification de `packages/crypto` est visible immédiatement par le web et le mobile, et
  déclenche leurs tests (Turborepo, dépendants inclus).
- La règle 2 du CLAUDE.md est vérifiée par le lint, pas seulement par la relecture.
- Les paquets partagés ne doivent dépendre d'aucune API propre à une plateforme (DOM, React Native).
