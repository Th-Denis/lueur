-- =============================================================================
-- Tests du trigger private.set_updated_at() (pgTAP).
--
-- Vérifie que updated_at est mis à jour à chaque modification et que
-- created_at ne peut pas être réécrit, y compris par un utilisateur authentifié
-- soumis à RLS.
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- Table de test, conforme aux garde-fous, supprimée par le rollback final.
create table public.timestamp_probe (
  id uuid primary key default private.uuid_generate_v7(),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.timestamp_probe
  for each row execute function private.set_updated_at();

-- Ligne créée « dans le passé » pour rendre les changements de date visibles.
insert into public.timestamp_probe (label, created_at, updated_at)
values ('initial', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

update public.timestamp_probe set label = 'modifié';

select is(
  (select updated_at from public.timestamp_probe),
  now(),
  'updated_at prend la date de la transaction lors d''une modification'
);

select is(
  (select created_at from public.timestamp_probe),
  '2026-01-01T00:00:00Z'::timestamptz,
  'created_at est conservé lors d''une modification'
);

update public.timestamp_probe set created_at = '2030-01-01T00:00:00Z';

select is(
  (select created_at from public.timestamp_probe),
  '2026-01-01T00:00:00Z'::timestamptz,
  'une tentative de réécriture de created_at est ignorée'
);

update public.timestamp_probe set updated_at = '2020-01-01T00:00:00Z';

select is(
  (select updated_at from public.timestamp_probe),
  now(),
  'une tentative d''antidater updated_at est ignorée'
);

-- Le trigger fonctionne aussi pour un utilisateur authentifié, qui n'a pas le
-- droit EXECUTE sur la fonction de trigger.
alter table public.timestamp_probe enable row level security;
grant select, insert, update on public.timestamp_probe to authenticated;
create policy timestamp_probe_all on public.timestamp_probe
  for all to authenticated using (true) with check (true);

set local role authenticated;
update public.timestamp_probe set created_at = '2031-01-01T00:00:00Z', label = 'par authenticated';
reset role;

select is(
  (select created_at from public.timestamp_probe),
  '2026-01-01T00:00:00Z'::timestamptz,
  'le trigger s''applique aux modifications d''un utilisateur authentifié'
);

select * from finish();

rollback;
