# 0006. Aucun droit par défaut en base et retours arrière vérifiés

- Statut : accepté
- Date : 2026-11-26

## Contexte

- Même avec `auto_expose_new_tables = false`, l'image Supabase accorde par défaut aux rôles de
  l'API (`anon`, `authenticated`, `service_role`), sur toute future table de `public`, les droits
  `TRUNCATE`, `REFERENCES`, `TRIGGER` et `MAINTAIN`. `TRUNCATE` n'est pas soumis à la RLS.
- Le CLAUDE.md demande des migrations « réversibles quand c'est possible », et la CLI Supabase ne
  gère pas de migrations descendantes.

## Décision

**Droits** : la migration de base révoque tous les droits par défaut des rôles de l'API dans
`public`. Chaque table et fonction reçoit ses `GRANT` explicites dans sa propre migration, en plus
de ses politiques RLS (défense en profondeur). Fait en SQL pour être identique sur Supabase Cloud
et en auto-hébergement.

**Garde-fous** : un test pgTAP vérifie sur toute table et fonction, présente ou future, la RLS, les
`COMMENT ON`, les clés primaires UUID v7, les dates avec fuseau, le trigger `updated_at`, le
`search_path` et l'absence d'`EXECUTE` pour `PUBLIC` et `anon`. Chaque garde-fou est lui-même
testé sur des objets volontairement fautifs.

**Retours arrière** : chaque migration a un script `supabase/rollbacks/<même nom>.sql`.
`pnpm db:check-rollbacks` part d'une base sans migration, applique les migrations une à une en
exportant le schéma, puis vérifie que chaque retour arrière restaure **exactement** l'export
d'avant sa migration.

## Alternatives écartées

- **Aller-retour migration → retour arrière → migration** : essayé en premier, il ne détecte pas un
  retour arrière incomplet (la seconde migration masque l'écart).
- **Révocation globale de `EXECUTE` pour `PUBLIC`** (`ALTER DEFAULT PRIVILEGES` sans schéma) :
  touche aussi les extensions installées plus tard (pgTAP par exemple) ; remplacée par une
  révocation explicite par fonction, imposée par un garde-fou.

## Conséquences

- Une table sans `GRANT` est inaccessible, même si sa politique RLS est oubliée ou trop large.
- Un retour arrière d'un environnement où `auto_expose_new_tables` valait `true` restaure l'état
  plus restrictif de l'image locale : c'est le sens sûr.
- Un changement destructif (suppression de colonne, par exemple) se découpe en plusieurs PR
  (ajout, copie, bascule, suppression), chacune réversible.
