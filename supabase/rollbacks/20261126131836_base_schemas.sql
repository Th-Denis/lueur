-- =============================================================================
-- Retour arrière de la migration 20261126131836_base_schemas
--
-- Annule exactement ce que crée la migration, dans l'ordre inverse.
-- Vérifié en CI par `pnpm db:check-rollbacks` : migration, retour arrière puis
-- migration à nouveau doivent produire un schéma identique.
--
-- Pourquoi `restrict` (et non `cascade`) : si un objet dépend encore de ces
-- fonctions ou schémas (une table créée par une migration plus récente, par
-- exemple), le retour arrière échoue au lieu de supprimer des données en silence.
-- =============================================================================

-- 4. Horodatage automatique
drop function private.set_updated_at() restrict;

-- 3. Identifiants UUID v7
drop function private.uuid_generate_v7() restrict;

-- 2. Droits implicites de Supabase dans `public`, rétablis à l'identique de
--    l'image locale (config.jsonc : auto_expose_new_tables = false), relevés
--    avec pg_dump avant migration.
--    Sur un projet où auto_expose_new_tables vaut true (défaut de Supabase
--    Cloud), l'état d'origine accordait davantage (ALL) : ce retour arrière
--    restaure alors un état plus restrictif, ce qui est le sens sûr.
alter default privileges for role postgres in schema public
  grant update on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant references, trigger, truncate, maintain on tables to anon, authenticated, service_role;

-- 1. Schémas (les GRANT USAGE disparaissent avec eux).
drop schema audit restrict;
drop schema private restrict;
