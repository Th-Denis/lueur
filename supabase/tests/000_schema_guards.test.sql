-- =============================================================================
-- Garde-fous de schéma (pgTAP), exécutés par `supabase test db`.
--
-- Rôle : vérifier automatiquement, pour TOUTE table et fonction présente ou
-- future des schémas du projet, les règles du CLAUDE.md (« Données » et règle 4)
-- et de la section 8 bis des specs. Une migration qui les oublie fait échouer
-- la CI, sans qu'aucun test spécifique ne soit à écrire.
--
-- Structure :
--   1. chaque garde-fou est une vue temporaire listant les objets fautifs ;
--   2. on vérifie que chaque liste est vide sur le schéma réel ;
--   3. on crée ensuite des objets volontairement fautifs et on vérifie que
--      chaque garde-fou les détecte (sinon, il ne protégerait rien).
-- Tout se déroule dans une transaction annulée à la fin.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- -----------------------------------------------------------------------------
-- 1. Garde-fous (vues temporaires : évaluées à chaque lecture)
-- -----------------------------------------------------------------------------

-- Schémas gérés par le projet (hors schémas internes de Supabase).
create temporary view project_schema as
  select n.oid, n.nspname
  from pg_namespace n
  where n.nspname in ('public', 'private', 'audit');

create temporary view project_table as
  select c.oid, format('%I.%I', s.nspname, c.relname) as name, c.relrowsecurity
  from pg_class c
  join project_schema s on s.oid = c.relnamespace
  where c.relkind in ('r', 'p');

create temporary view project_column as
  select c.oid as table_oid, a.attnum, a.attname, a.atttypid,
         format('%I.%I.%I', s.nspname, c.relname, a.attname) as name
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join project_schema s on s.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm')
    and a.attnum > 0
    and not a.attisdropped;

create temporary view guard_table_without_rls as
  select name from project_table where not relrowsecurity;

create temporary view guard_relation_without_comment as
  select format('%I.%I', s.nspname, c.relname) as name
  from pg_class c
  join project_schema s on s.oid = c.relnamespace
  where c.relkind in ('r', 'p', 'v', 'm')
    and obj_description(c.oid, 'pg_class') is null;

create temporary view guard_column_without_comment as
  select name from project_column where col_description(table_oid, attnum) is null;

create temporary view guard_table_without_primary_key as
  select t.name
  from project_table t
  where not exists (select 1 from pg_constraint k where k.conrelid = t.oid and k.contype = 'p');

-- Une clé primaire à une seule colonne nommée `id` est un UUID v7 généré en base.
-- Les tables d'association (clé composite) ne sont pas concernées.
create temporary view guard_id_not_uuid_v7 as
  select t.name
  from project_table t
  join pg_constraint k on k.conrelid = t.oid and k.contype = 'p' and cardinality(k.conkey) = 1
  join pg_attribute a on a.attrelid = t.oid and a.attnum = k.conkey[1]
  left join pg_attrdef d on d.adrelid = t.oid and d.adnum = a.attnum
  where a.attname = 'id'
    and (
      a.atttypid <> 'uuid'::regtype
      or pg_get_expr(d.adbin, d.adrelid) is distinct from 'private.uuid_generate_v7()'
    );

-- Seule reveal_local est une date « flottante » sans fuseau (specs, section 5).
create temporary view guard_timestamp_without_time_zone as
  select c.name
  from project_column c
  join project_table t on t.oid = c.table_oid
  where c.atttypid = 'timestamp without time zone'::regtype
    and c.attname <> 'reveal_local';

create temporary view guard_updated_at_without_trigger as
  select t.name
  from project_table t
  where exists (
      select 1 from pg_attribute a
      where a.attrelid = t.oid and a.attname = 'updated_at' and not a.attisdropped
    )
    and not exists (
      select 1 from pg_trigger g
      where g.tgrelid = t.oid
        and not g.tgisinternal
        and g.tgfoid = 'private.set_updated_at()'::regprocedure
    );

-- Nom toujours qualifié par son schéma : `regprocedure::text` l'omet pour les
-- schémas du search_path (public), ce qui rendrait les messages ambigus.
create temporary view project_function as
  select p.oid, p.proconfig, p.proacl,
         format('%I.%I(%s)', s.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as name
  from pg_proc p
  join project_schema s on s.oid = p.pronamespace;

create temporary view guard_function_without_search_path as
  select p.name
  from project_function p
  where not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) as setting
    where setting like 'search_path=%'
  );

-- proacl nul = droits par défaut de Postgres, c'est-à-dire EXECUTE pour PUBLIC.
-- Dans aclexplode, le grantee 0 désigne PUBLIC.
-- Pourquoi pg_roles et non 'anon'::regrole : une vue ne peut pas contenir de
-- constante de type regrole (Postgres refuse cette dépendance).
create temporary view guard_function_executable_by_public_or_anon as
  select p.name
  from project_function p
  where p.proacl is null
     or exists (
       select 1 from aclexplode(p.proacl) as acl
       where acl.privilege_type = 'EXECUTE'
         and (acl.grantee = 0 or acl.grantee = (select oid from pg_roles where rolname = 'anon'))
     );

-- -----------------------------------------------------------------------------
-- 2. Le schéma réel respecte les règles
-- -----------------------------------------------------------------------------

select has_schema('private', 'le schéma private existe');
select has_schema('audit', 'le schéma audit existe');
select ok(
  not has_schema_privilege('anon', 'private', 'usage')
    and not has_schema_privilege('anon', 'audit', 'usage'),
  'anon n''a aucun accès aux schémas private et audit'
);
select ok(
  not has_schema_privilege('authenticated', 'audit', 'usage'),
  'authenticated n''a aucun accès au schéma audit'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'create')
    and not has_schema_privilege('authenticated', 'public', 'create'),
  'authenticated ne peut créer aucun objet dans private ni public'
);

select is_empty('select name from guard_table_without_rls', 'RLS est activée sur toutes les tables (règle 4)');
select is_empty('select name from guard_relation_without_comment', 'chaque table et vue a un COMMENT ON');
select is_empty('select name from guard_column_without_comment', 'chaque colonne a un COMMENT ON');
select is_empty('select name from guard_table_without_primary_key', 'chaque table a une clé primaire');
select is_empty('select name from guard_id_not_uuid_v7', 'chaque clé primaire id est un UUID v7 généré en base');
select is_empty('select name from guard_timestamp_without_time_zone', 'aucune date sans fuseau, sauf reveal_local');
select is_empty('select name from guard_updated_at_without_trigger', 'chaque updated_at est maintenu par trigger');
select is_empty('select name from guard_function_without_search_path', 'chaque fonction fixe son search_path');
select is_empty(
  'select name from guard_function_executable_by_public_or_anon',
  'aucune fonction n''est exécutable par PUBLIC ni par anon'
);

-- Aucun droit implicite pour les rôles de l'API sur les futurs objets de public.
select is_empty(
  $$
    select format('%s : %s', d.defaclobjtype, acl.privilege_type)
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace and n.nspname = 'public'
    cross join lateral aclexplode(d.defaclacl) as acl
    where d.defaclrole = 'postgres'::regrole
      and acl.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  $$,
  'aucun droit par défaut pour anon, authenticated et service_role dans public'
);

-- -----------------------------------------------------------------------------
-- 3. Chaque garde-fou détecte bien un objet fautif
-- -----------------------------------------------------------------------------

-- Table sans RLS, sans commentaire, sans clé primaire, avec une date sans
-- fuseau et un updated_at sans trigger.
create table public.guard_probe_bad (
  created_on timestamp without time zone,
  updated_at timestamptz
);

-- Table dont la clé primaire id n'est pas un UUID v7.
create table public.guard_probe_bad_id (id bigint primary key);

-- Fonction sans search_path et exécutable par PUBLIC (droits par défaut).
create function public.guard_probe_bad_function() returns int language sql as 'select 1';

select ok(
  'public.guard_probe_bad' in (select name from guard_table_without_rls),
  'le garde-fou RLS détecte une table sans RLS'
);
select ok(
  'public.guard_probe_bad' in (select name from guard_relation_without_comment),
  'le garde-fou des commentaires détecte une table sans COMMENT ON'
);
select ok(
  'public.guard_probe_bad.created_on' in (select name from guard_column_without_comment),
  'le garde-fou des commentaires détecte une colonne sans COMMENT ON'
);
select ok(
  'public.guard_probe_bad' in (select name from guard_table_without_primary_key),
  'le garde-fou des clés primaires détecte une table sans clé primaire'
);
select ok(
  'public.guard_probe_bad_id' in (select name from guard_id_not_uuid_v7),
  'le garde-fou UUID v7 détecte une clé primaire id d''un autre type'
);
select ok(
  'public.guard_probe_bad.created_on' in (select name from guard_timestamp_without_time_zone),
  'le garde-fou des fuseaux détecte une date sans fuseau'
);
select ok(
  'public.guard_probe_bad' in (select name from guard_updated_at_without_trigger),
  'le garde-fou updated_at détecte une table sans trigger'
);
select ok(
  'public.guard_probe_bad_function()' in (select name from guard_function_without_search_path),
  'le garde-fou search_path détecte une fonction sans search_path'
);
select ok(
  'public.guard_probe_bad_function()' in (select name from guard_function_executable_by_public_or_anon),
  'le garde-fou EXECUTE détecte une fonction exécutable par PUBLIC'
);

-- Les objets conformes ne sont pas signalés.
create table public.guard_probe_good (
  id uuid primary key default private.uuid_generate_v7(),
  reveal_local timestamp without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guard_probe_good enable row level security;
create trigger set_updated_at before update on public.guard_probe_good
  for each row execute function private.set_updated_at();
comment on table public.guard_probe_good is 'Table de test conforme.';
comment on column public.guard_probe_good.id is 'Identifiant.';
comment on column public.guard_probe_good.reveal_local is 'Date de révélation.';
comment on column public.guard_probe_good.created_at is 'Création.';
comment on column public.guard_probe_good.updated_at is 'Modification.';

select ok(
  'public.guard_probe_good' not in (select name from guard_table_without_rls)
    and 'public.guard_probe_good' not in (select name from guard_relation_without_comment)
    and 'public.guard_probe_good' not in (select name from guard_table_without_primary_key)
    and 'public.guard_probe_good' not in (select name from guard_id_not_uuid_v7)
    and 'public.guard_probe_good' not in (select name from guard_updated_at_without_trigger),
  'une table conforme n''est signalée par aucun garde-fou de table'
);
select ok(
  not exists (
    select 1 from guard_column_without_comment where name like 'public.guard_probe_good.%'
  )
    and not exists (
      select 1 from guard_timestamp_without_time_zone where name like 'public.guard_probe_good.%'
    ),
  'reveal_local et les colonnes commentées ne sont pas signalées'
);

-- Une table créée dans public n'est accessible à aucun rôle de l'API sans GRANT.
select ok(
  not has_table_privilege('anon', 'public.guard_probe_good', 'select')
    and not has_table_privilege('authenticated', 'public.guard_probe_good', 'select')
    and not has_table_privilege('authenticated', 'public.guard_probe_good', 'insert'),
  'une nouvelle table de public n''est accessible ni à anon ni à authenticated sans GRANT'
);
select * from finish();

rollback;
