# Décisions d'architecture (ADR)

Chaque décision structurante du projet est consignée ici (CLAUDE.md, « Façon de travailler »).
Un ADR accepté ne se réécrit pas : une nouvelle décision crée un nouvel ADR qui le remplace.

| N°                                                   | Décision                                                       | Statut  |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------- |
| [0001](0001-monorepo-pnpm-turborepo.md)              | Monorepo pnpm et Turborepo, cryptographie isolée               | Accepté |
| [0002](0002-versions-et-chaine-approvisionnement.md) | Versions des outils et politique de chaîne d'approvisionnement | Accepté |
| [0003](0003-uuid-v7-fonction-sql.md)                 | UUID v7 générés par une fonction SQL                           | Accepté |
| [0004](0004-nonce-csp-web-crypto.md)                 | Nonce CSP généré avec Web Crypto plutôt que libsodium          | Accepté |
| [0005](0005-outils-securite-ci.md)                   | Outils de sécurité de la CI                                    | Accepté |
| [0006](0006-droits-par-defaut-et-retours-arriere.md) | Aucun droit par défaut en base et retours arrière vérifiés     | Accepté |

## Modèle

```markdown
# NNNN. Titre de la décision

- Statut : proposé | accepté | remplacé par NNNN
- Date : AAAA-MM-JJ

## Contexte

## Décision

## Alternatives écartées

## Conséquences
```
