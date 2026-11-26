# Modèle de données

Dictionnaire de données de la base Postgres (Supabase). Il est tenu à jour dans la même PR que
chaque migration (CLAUDE.md, section « Données »). Les commentaires `COMMENT ON` en base font foi ;
ce document les rassemble et explique les conventions.

> État actuel : **fondations uniquement** (étape 1). Aucune table métier n'existe encore. Le modèle
> cible est décrit dans [SPECS.md](SPECS.md), section 6.

## Schémas

| Schéma    | Rôle                                                                | Exposé par l'API | Accès                                                                    |
| --------- | ------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `public`  | Tables lues et écrites par les clients, toujours sous RLS           | Oui (PostgREST)  | GRANT explicite par table ; aucun droit par défaut                       |
| `private` | Fonctions et données internes                                       | Non              | `USAGE` pour `authenticated` et `service_role`, `EXECUTE` au cas par cas |
| `audit`   | Journal de sécurité, en ajout seul, écrit par des fonctions serveur | Non              | `USAGE` pour `service_role` uniquement                                   |

## Fonctions

| Fonction                     | Rôle                                                                                        | Droits                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `private.uuid_generate_v7()` | UUID v7 (RFC 9562) : 48 bits d'horodatage en ms, 74 bits aléatoires. Défaut de chaque `id`. | `EXECUTE` : `authenticated`, `service_role` |
| `private.set_updated_at()`   | Trigger `BEFORE UPDATE` : `updated_at := now()`, `created_at` immuable.                     | Aucun `EXECUTE` (inutile pour un trigger)   |

## Conventions (vérifiées automatiquement)

Les règles ci-dessous sont contrôlées sur **toute** table ou fonction, présente ou future, des
schémas `public`, `private` et `audit` par `supabase/tests/000_schema_guards.test.sql`. Une
migration qui en oublie une fait échouer la CI.

| Règle                                                                                          | Source                 |
| ---------------------------------------------------------------------------------------------- | ---------------------- |
| RLS activée sur chaque table                                                                   | CLAUDE.md, règle 4     |
| `COMMENT ON` sur chaque table, vue et colonne                                                  | CLAUDE.md, « Données » |
| Clé primaire sur chaque table                                                                  | Specs, 8 bis           |
| Clé primaire `id` : `uuid` par défaut `private.uuid_generate_v7()`                             | CLAUDE.md, « Données » |
| Aucune colonne `timestamp without time zone`, sauf `reveal_local`                              | Specs, section 5       |
| Toute table ayant `updated_at` a le trigger `private.set_updated_at()`                         | Specs, 8 bis           |
| Toute fonction fixe son `search_path`                                                          | Durcissement Postgres  |
| Aucune fonction exécutable par `PUBLIC` ou `anon`                                              | Moindre privilège      |
| Aucun droit par défaut pour `anon`, `authenticated`, `service_role` sur les objets de `public` | Moindre privilège      |

Autres conventions (relues par l'agent `data-architect`) :

- **Nommage** : tables au pluriel en `snake_case`, contraintes `<table>_<colonnes>_<type>`
  (`_pkey`, `_fkey`, `_key`, `_check`).
- **Dates** : `timestamptz` UTC, `created_at` et `updated_at` en `NOT NULL DEFAULT now()`.
- **Clés étrangères** : `ON DELETE` toujours explicite, index sur chaque clé étrangère.
- **Index** : chacun justifié en commentaire par la requête qu'il sert.
- **Statuts** : enums Postgres ; valeurs contraintes : domaines (`CHECK`).
- **Montants** (futur) : entiers en centimes avec code devise ISO 4217.

## Droits par défaut de Supabase (constat)

Même avec `auto_expose_new_tables = false`, l'image Supabase accorde sur les futures tables de
`public`, aux rôles `anon`, `authenticated` et `service_role`, les droits `REFERENCES`, `TRIGGER`,
`TRUNCATE` et `MAINTAIN`, ainsi que `UPDATE` sur les séquences. `TRUNCATE` n'est pas soumis à la
RLS : un utilisateur anonyme pourrait vider une table. La migration de base révoque ces droits.

## Migrations et retours arrière

- Migrations : `supabase/migrations/<version>_<nom>.sql`, créées par `supabase migration new`.
- Retours arrière : `supabase/rollbacks/<même nom>.sql`, obligatoires.
- `pnpm db:check-rollbacks` vérifie que chaque retour arrière remet la base **exactement** dans
  l'état d'avant sa migration (comparaison `pg_dump --schema-only`).

| Version          | Nom            | Contenu                                                                                       |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `20261126131836` | `base_schemas` | Schémas `private` et `audit`, révocation des droits par défaut, UUID v7, trigger d'horodatage |

## Évolutions anticipées

Préparées dans le modèle cible (specs, section 8 ter), sans créer les tables futures :
`items.audience_type`, `items.media_type`, `calendars.visibility`, `profiles.account_type`, et
l'accès centralisé par `can_access_item`.
