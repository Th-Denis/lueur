# Configuration Claude Code du projet

Ce dossier configure le développement agentique décrit dans [CLAUDE.md](../CLAUDE.md), section
« Développement agentique ». Toute modification de `agents/` ou de `settings.json` demande la
validation explicite de Thibaut.

## Sous-agents (`agents/`)

| Agent               | Rôle                                                                       | Outils                         |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| `security-reviewer` | Relecture de sécurité, rapport bloquant ou non (section 7 bis des specs)   | Lecture seule                  |
| `data-architect`    | Schéma, migrations, contraintes, index, RLS, `COMMENT ON`, `DATA_MODEL.md` | Lecture, écriture, commandes   |
| `test-writer`       | Tests unitaires, e2e, pgTAP et de sécurité                                 | Lecture, écriture, commandes   |
| `doc-writer`        | En-têtes, JSDoc, commentaires « pourquoi », ADR et documentation           | Lecture, écriture (sans shell) |

`security-reviewer` ne peut ni exécuter de commande ni écrire : l'agent qui le lance enregistre le
diff (`git diff main...HEAD`) dans un fichier et lui en donne le chemin.

## Hooks (`settings.json` et `hooks/`)

| Événement     | Script               | Effet                                                                  |
| ------------- | -------------------- | ---------------------------------------------------------------------- |
| `PreToolUse`  | `pre-tool-guard.mjs` | Refuse tout accès à un fichier `.env` ou de secrets ; demande l'accord |
|               |                      | de l'humain avant une commande destructrice ou touchant la production  |
| `PostToolUse` | `post-edit.mjs`      | Prettier, ESLint et typecheck du paquet après chaque modification      |
| `Stop`        | `stop-tests.mjs`     | Tests unitaires des paquets modifiés (et de leurs dépendants) avant de |
|               |                      | terminer ; l'agent est relancé si un test échoue                       |

Les hooks sont écrits en JavaScript sans dépendance (Node uniquement) et testés :

```sh
pnpm test:hooks   # tests Vitest des hooks
pnpm lint:hooks   # ESLint sur .claude/hooks
```

Commandes soumises à confirmation (décision `ask`) : `rm -rf` et équivalents, `git push` sur
`main` ou forcé, `git reset --hard`, `git clean -f`, `supabase db reset` hors local,
`supabase db push`, `supabase link`, `supabase functions deploy`, `DROP` et `TRUNCATE`,
`terraform apply` ou `destroy`, et les commandes Scaleway autres que la lecture.

**Limite assumée** : l'analyse des commandes est heuristique. Elle évite les accidents ; elle ne
résiste pas à un contournement volontaire. La protection de fond reste l'absence de tout secret de
production sur le poste de développement.

## Permissions (`settings.json`)

- `deny` : lecture et écriture des fichiers `.env` (hors `.env.example`), `.pem` et `.key`.
- `ask` : les commandes destructrices listées ci-dessus, et la modification de `CLAUDE.md`, des
  sous-agents, de `settings.json` et des workflows de CI (garde-fous sur les agents eux-mêmes).

Les réglages personnels vont dans `settings.local.json`, jamais versionné.
