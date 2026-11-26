-- =============================================================================
-- Migration 20261126131836_base_schemas
--
-- But : poser les fondations communes à toutes les tables futures, sans créer
-- aucune table métier (étape 1 du plan de développement).
--   1. Schémas `private` (fonctions internes) et `audit` (journal de sécurité),
--      jamais exposés par l'API (specs, section 8 bis).
--   2. Suppression des droits implicites que Supabase accorde dans `public` :
--      chaque objet recevra ses GRANT explicites (moindre privilège).
--   3. `private.uuid_generate_v7()` : identifiants UUID v7 pour toutes les clés
--      primaires (CLAUDE.md, section « Données » ; ADR 0003).
--   4. `private.set_updated_at()` : trigger qui maintient `updated_at` et rend
--      `created_at` immuable.
--
-- Retour arrière : supabase/rollbacks/20261126131836_base_schemas.sql
-- Tests : supabase/tests/0*.test.sql (garde-fous de schéma, UUID v7, trigger).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Schémas
-- -----------------------------------------------------------------------------

create schema private;

comment on schema private is
  'Fonctions et données internes. Jamais exposé par l''API (PostgREST) ; '
  'seuls les rôles qui en ont besoin reçoivent USAGE, objet par objet.';

create schema audit;

comment on schema audit is
  'Journal de sécurité (changements de fuseau, remplacements de photos, accès refusés…). '
  'Écriture uniquement par des fonctions serveur ; aucun accès pour anon ni authenticated.';

-- Pourquoi révoquer explicitement : en Postgres, PUBLIC (tous les rôles) ne
-- reçoit aucun droit sur un nouveau schéma, mais on l'écrit pour que
-- l'intention soit lisible et vérifiée par les tests de garde-fou.
revoke all on schema private from public;
revoke all on schema audit from public;

-- Pourquoi `authenticated` reçoit USAGE sur `private` : les valeurs par défaut
-- des colonnes (`id default private.uuid_generate_v7()`) sont évaluées avec les
-- droits de l'utilisateur qui insère. USAGE seul ne donne accès à aucun objet :
-- chaque fonction exige en plus un GRANT EXECUTE explicite. Le schéma n'est pas
-- dans `api.schemas` (config.jsonc), donc il reste invisible depuis l'API.
grant usage on schema private to authenticated, service_role;
grant usage on schema audit to service_role;

-- -----------------------------------------------------------------------------
-- 2. Aucun droit implicite dans `public`
-- -----------------------------------------------------------------------------

-- Supabase accorde par défaut tous les droits sur les futurs objets de `public`
-- aux rôles de l'API. On les retire : une table sans GRANT explicite doit être
-- inaccessible, même si sa politique RLS est oubliée (défense en profondeur).
-- Pourquoi dans une migration et pas seulement dans config.jsonc : ce réglage
-- doit être identique sur Supabase Cloud et en auto-hébergement.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Identifiants UUID v7
-- -----------------------------------------------------------------------------

-- Pourquoi une fonction SQL : `uuidv7()` n'existe qu'à partir de Postgres 18,
-- alors que Supabase Cloud et Scaleway proposent au plus Postgres 17 (ADR 0003).
-- À remplacer par `uuidv7()` natif quand Postgres 18 sera disponible partout.
--
-- Principe (RFC 9562, section 5.7) : on part d'un UUID v4 aléatoire, dont on
-- remplace les 48 premiers bits par l'horodatage Unix en millisecondes, puis on
-- passe la version de 4 (0100) à 7 (0111) en mettant à 1 les bits 52 et 53.
-- Les bits de variante (10) du v4 sont déjà ceux attendus pour un v7.
--
-- Ce n'est pas une primitive cryptographique : l'aléa (74 bits) vient de
-- `gen_random_uuid()`, qui utilise le générateur aléatoire sécurisé de Postgres.
-- Limite assumée : un UUID v7 révèle sa date de création à la milliseconde
-- près (documenté dans SECURITY.md) ; deux UUID créés dans la même
-- milliseconde ne sont pas ordonnés entre eux.
create function private.uuid_generate_v7()
returns uuid
language sql
volatile
parallel safe
-- search_path vide : aucune fonction ne peut être détournée par un objet homonyme
-- créé dans un autre schéma. pg_catalog reste toujours consulté en premier.
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          -- Octets 3 à 8 d'un bigint = ses 48 bits de poids faible (millisecondes Unix).
          placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

comment on function private.uuid_generate_v7() is
  'Génère un UUID v7 (RFC 9562) : 48 bits d''horodatage en millisecondes puis 74 bits aléatoires. '
  'Valeur par défaut de toutes les clés primaires. Utilise clock_timestamp() (et non now()) pour que '
  'les lignes d''une même transaction restent ordonnées à la milliseconde près. À remplacer par uuidv7() natif (Postgres 18).';

-- EXECUTE explicite, uniquement pour les rôles qui insèrent des lignes.
revoke all on function private.uuid_generate_v7() from public;
grant execute on function private.uuid_generate_v7() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Horodatage automatique
-- -----------------------------------------------------------------------------

-- À attacher à chaque table qui a `created_at` et `updated_at` :
--   create trigger set_updated_at before update on public.<table>
--     for each row execute function private.set_updated_at();
-- Pourquoi un trigger plutôt que le code applicatif : la règle s'applique quel
-- que soit le client (API, Edge Function, migration), et `created_at` ne peut
-- pas être réécrit pour antidater ou postdater une ligne.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- now() = début de la transaction, comme la valeur par défaut de created_at.
  new.updated_at := now();
  -- created_at est une donnée d'audit : toute tentative de modification est ignorée.
  new.created_at := old.created_at;
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'Trigger BEFORE UPDATE : met updated_at à now() et conserve la valeur d''origine de created_at.';

-- Pourquoi aucun GRANT EXECUTE : le droit d'exécuter une fonction de trigger
-- n'est vérifié qu'à la création du trigger (par le propriétaire de la table),
-- jamais lors de son déclenchement.
revoke all on function private.set_updated_at() from public;
