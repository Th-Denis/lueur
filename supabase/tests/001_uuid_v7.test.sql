-- =============================================================================
-- Tests de private.uuid_generate_v7() (pgTAP).
--
-- Vérifie le format RFC 9562 (version 7, variante 10), l'horodatage encodé,
-- l'unicité, l'ordre chronologique et les droits d'exécution.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Échantillon généré une seule fois, réutilisé par plusieurs tests.
create temporary table sample as
  select private.uuid_generate_v7() as id
  from generate_series(1, 2000);

select is(
  (select count(*) from sample where substr(id::text, 15, 1) <> '7'),
  0::bigint,
  'chaque UUID porte la version 7 (13e chiffre hexadécimal)'
);

select is(
  (select count(*) from sample where substr(id::text, 20, 1) not in ('8', '9', 'a', 'b')),
  0::bigint,
  'chaque UUID porte la variante RFC 9562 (bits 10)'
);

select is(
  (select count(distinct id) from sample),
  2000::bigint,
  '2 000 UUID générés sont tous distincts'
);

-- Les 48 premiers bits = millisecondes Unix au moment de la génération.
select ok(
  abs(
    ('x' || lpad(replace(substr(private.uuid_generate_v7()::text, 1, 13), '-', ''), 16, '0'))::bit(64)::bigint
    - floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  ) < 1000,
  'l''horodatage encodé correspond à l''heure du serveur, à moins d''une seconde près'
);

-- Ordre chronologique : un UUID généré plus tard est toujours plus grand.
create temporary table ordered (position int, id uuid);
insert into ordered values (1, private.uuid_generate_v7());
select pg_sleep(0.005);
insert into ordered values (2, private.uuid_generate_v7());
select pg_sleep(0.005);
insert into ordered values (3, private.uuid_generate_v7());

select is(
  (select array_agg(position order by id) from ordered),
  array[1, 2, 3],
  'des UUID générés à quelques millisecondes d''écart sont triés dans l''ordre de création'
);

-- Pourquoi : clock_timestamp() et non now(), sinon tous les UUID d'une même
-- transaction auraient le même horodatage.
select isnt(
  (select min(substr(id::text, 1, 13)) from ordered),
  (select max(substr(id::text, 1, 13)) from ordered),
  'l''horodatage avance au sein d''une même transaction'
);

select is(
  pg_typeof(private.uuid_generate_v7())::text,
  'uuid',
  'la fonction renvoie le type uuid'
);

select function_privs_are(
  'private', 'uuid_generate_v7', array[]::text[], 'authenticated', array['EXECUTE'],
  'authenticated peut générer un identifiant (valeur par défaut des colonnes id)'
);

select function_privs_are(
  'private', 'uuid_generate_v7', array[]::text[], 'anon', array[]::text[],
  'anon ne peut pas exécuter la fonction'
);

select is(
  (select provolatile from pg_proc where oid = 'private.uuid_generate_v7()'::regprocedure),
  'v'::"char",
  'la fonction est VOLATILE (une nouvelle valeur à chaque appel)'
);

select * from finish();

rollback;
