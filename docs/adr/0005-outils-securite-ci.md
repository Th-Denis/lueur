# 0005. Outils de sécurité de la CI

- Statut : accepté
- Date : 2026-11-26

## Contexte

La règle 8 du CLAUDE.md et la section 7 bis des specs imposent une CI bloquante : CodeQL, Semgrep,
gitleaks, `pnpm audit`, tests RLS et d'autorisation, actions épinglées. Le code étant largement
généré par IA, ces contrôles automatiques sont la première ligne de défense.

## Décision

| Contrôle         | Outil                                       | Mise en œuvre                                      |
| ---------------- | ------------------------------------------- | -------------------------------------------------- |
| Analyse statique | CodeQL (`security-extended`)                | JS/TS et workflows Actions                         |
| Analyse statique | Semgrep CLI, **sans compte**                | Règles OWASP, TS, React, Next.js, secrets, Actions |
| Secrets          | gitleaks                                    | Tout l'historique, résultats masqués               |
| Workflows        | actionlint, zizmor (`--offline`)            | Syntaxe, droits, épinglage, injections             |
| Dépendances      | `pnpm audit`, dependency-review, Dependabot | Toute vulnérabilité connue bloque                  |
| Base de données  | `supabase db lint`, pgTAP, retours arrière  | Garde-fous de schéma, RLS, réversibilité           |
| Application      | Vitest, Playwright                          | Unitaires, e2e sur un build de production          |

- Dépôt **public** pour bénéficier gratuitement de CodeQL et de la protection de branche.
- Actions tierces épinglées par **SHA complet**, version en commentaire.
- Outils d'analyse lancés depuis des **images Docker épinglées par empreinte sha256** plutôt que
  par leurs actions officielles.
- Workflows sans droit par défaut (`permissions: {}`), droits minimaux par job,
  `persist-credentials: false`, aucune télémétrie.

## Alternatives écartées

- **Actions officielles de Semgrep et gitleaks** : la première demande un compte Semgrep, la
  seconde une licence pour les organisations ; une couche de code supplémentaire à faire confiance.
- **Semgrep App** : envoie le code et les résultats à un tiers.

## Conséquences

- Les images Docker ne sont pas suivies par Dependabot : mise à jour manuelle, empreinte relevée
  avec `docker buildx imagetools inspect <image>:<version>`.
- Les règles Semgrep du registre évoluent : un nouveau résultat peut apparaître sans changement du
  code (analyse hebdomadaire programmée). Il se corrige ; il ne se désactive pas.
- La protection de la branche `main` (contrôles obligatoires, pas de push direct) est à configurer
  dans les réglages du dépôt.
