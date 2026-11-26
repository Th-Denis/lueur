# Lueur

Calendrier de photos programmées (par exemple un calendrier de l'Avent), chiffrées de bout en bout :
ni le serveur ni l'équipe technique ne peuvent voir les photos.

> Projet en cours de construction (étape 1 du plan de développement). Les spécifications complètes
> sont dans [docs/SPECS.md](docs/SPECS.md).

## Prérequis

- Node.js 26 LTS (version exacte dans [.nvmrc](.nvmrc))
- pnpm 12 (version exacte dans le champ `packageManager` de [package.json](package.json))

## Démarrage

```sh
pnpm install
pnpm dev          # web (http://localhost:3000) et mobile (Expo)
pnpm test         # tests unitaires (Vitest)
pnpm test:e2e     # tests end-to-end web (Playwright)
pnpm lint && pnpm typecheck
```

## Organisation

| Dossier           | Rôle                                                         |
| ----------------- | ------------------------------------------------------------ |
| `apps/web`        | Site web responsive (Next.js, App Router)                    |
| `apps/mobile`     | Application mobile (Expo), squelette développé après la bêta |
| `packages/crypto` | Toute la cryptographie, et uniquement là                     |
| `packages/core`   | Types, schémas de validation, erreurs métier, client API     |

## Sécurité

Les règles de sécurité du projet sont décrites dans [CLAUDE.md](CLAUDE.md) et dans la section 7 bis des
[spécifications](docs/SPECS.md).
