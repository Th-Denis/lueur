# Lueur

Calendrier de photos programmées (par exemple un calendrier de l'Avent), chiffrées de bout en bout :
ni le serveur ni l'équipe technique ne peuvent voir les photos.

> Projet en cours de construction (étape 1 du plan de développement : fondations). Les
> spécifications complètes sont dans [docs/SPECS.md](docs/SPECS.md).

## Prérequis

- Node.js 26 LTS (version exacte dans [.nvmrc](.nvmrc))
- pnpm 12 (version exacte dans le champ `packageManager` de [package.json](package.json))
- Docker, pour la base Supabase locale. La CLI Supabase est installée par `pnpm install`, en
  version figée : rien d'autre à installer.

## Démarrage

```sh
pnpm install
pnpm dev          # Supabase local, puis web (http://localhost:3000) et mobile (Expo)
```

Studio Supabase (interface de la base locale) : http://127.0.0.1:54323. Les emails envoyés en
local sont visibles sur http://127.0.0.1:54324.

## Commandes

| Commande                      | Rôle                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| `pnpm test`                   | Tests unitaires (Vitest) des paquets, des hooks et des scripts  |
| `pnpm test:e2e`               | Tests end-to-end web (Playwright, sur un build de production)   |
| `pnpm lint && pnpm typecheck` | Lint et vérification des types                                  |
| `pnpm format`                 | Formatage (Prettier)                                            |
| `pnpm db:start` / `db:stop`   | Démarrer ou arrêter Supabase local                              |
| `pnpm db:reset`               | Recréer la base locale depuis les migrations                    |
| `pnpm db:test`                | Tests de la base (pgTAP) : garde-fous de schéma, RLS, fonctions |
| `pnpm db:lint`                | Lint du schéma (`public`, `private`, `audit`)                   |
| `pnpm db:check-rollbacks`     | Vérifie que chaque migration a un retour arrière exact          |

Nouvelle migration : `pnpm exec supabase migration new <nom>`, plus son retour arrière dans
`supabase/rollbacks/` (voir [DATA_MODEL.md](docs/DATA_MODEL.md)).

## Organisation

| Dossier           | Rôle                                                         |
| ----------------- | ------------------------------------------------------------ |
| `apps/web`        | Site web responsive (Next.js, App Router)                    |
| `apps/mobile`     | Application mobile (Expo), squelette développé après la bêta |
| `packages/crypto` | Toute la cryptographie, et uniquement là                     |
| `packages/core`   | Types, schémas de validation, erreurs métier, client API     |
| `supabase`        | Configuration locale, migrations, retours arrière, tests     |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) : vue d'ensemble, couches, flux, environnements
- [SECURITY.md](SECURITY.md) : modèle de menace, limites assumées, signalement des vulnérabilités
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) : dictionnaire de données et conventions de la base
- [docs/adr/](docs/adr/README.md) : décisions d'architecture
- [CLAUDE.md](CLAUDE.md) et [.claude/README.md](.claude/README.md) : règles et outillage du
  développement avec Claude Code

## Sécurité

Pour signaler une vulnérabilité, voir [SECURITY.md](SECURITY.md). N'ouvrez pas d'issue publique.
