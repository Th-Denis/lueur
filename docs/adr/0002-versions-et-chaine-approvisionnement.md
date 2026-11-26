# 0002. Versions des outils et politique de chaîne d'approvisionnement

- Statut : accepté
- Date : 2026-11-26

## Contexte

La règle 9 du CLAUDE.md impose des dépendances figées, un lockfile et des actions épinglées. Les
attaques par paquet npm compromis (compte de mainteneur volé, version malveillante publiée puis
retirée en quelques heures ou jours) sont la principale menace sur la chaîne d'approvisionnement
d'un projet JavaScript.

## Décision

**Versions retenues** (novembre 2026) :

| Outil        | Version | Raison                                                                                     |
| ------------ | ------- | ------------------------------------------------------------------------------------------ |
| Node.js      | 26 LTS  | Version LTS active                                                                         |
| pnpm         | 12      | Catalogues, politiques de sécurité de l'installation                                       |
| TypeScript   | 6.0     | Pas la 7 : typescript-eslint 8 exige `typescript < 6.1`                                    |
| ESLint       | 9       | En fin de support, mais les plugins de `eslint-config-next` ne gèrent pas encore ESLint 10 |
| React        | 19.3.0  | Version imposée par Expo SDK 58 : une seule copie de React dans le monorepo                |
| Supabase CLI | 3.2.0   | Même version sur tous les postes et en CI                                                  |

**Politique d'installation** (`pnpm-workspace.yaml`) :

- versions exactes (`savePrefix: ''`), lockfile versionné, `--frozen-lockfile` en CI ;
- `minimumReleaseAge: 10080` : aucune version publiée depuis moins de **7 jours** ;
- `blockExoticSubdeps: true` : aucune dépendance indirecte hors du registre npm ;
- `trustPolicy: no-downgrade` : refus d'une version dont les garanties de publication baissent ;
- `engineStrict: true` : versions de Node et de pnpm imposées ;
- correctifs de dépendances indirectes par `overrides`, chacun justifié en commentaire.

Dependabot applique le même délai de 7 jours (`cooldown`).

## Alternatives écartées

- **Délai de 24 h** (choix initial de la PR 1) : relevé à 7 jours sur recommandation des règles
  Semgrep, la plupart des paquets compromis étant détectés en quelques jours.
- **Versions avec `^`** : mises à jour silencieuses, contraires à la règle 9.

## Conséquences

- Une dépendance ne peut être ajoutée ou mise à jour qu'une semaine après sa publication. Six
  dépendances ont été ramenées à leur dernière version de plus de 7 jours lors du passage à cette
  règle (PR 4).
- Un correctif de sécurité urgent passe par une exception nominative dans
  `minimumReleaseAgeExclude`, justifiée en commentaire et retirée une fois le délai écoulé.
- ESLint 9 et TypeScript 6 sont à remonter dès que leurs écosystèmes le permettent.
