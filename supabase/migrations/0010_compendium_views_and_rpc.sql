-- =============================================================================
-- MARCH OF TIME — MIGRATION 0010: COMPENDIUM VIEWS & BACKEND RPC FUNCTIONS
-- Moves Compendium aggregation, active-filtering views, and atomic soft-delete
-- slug archiving into PostgreSQL so Angular services stay thin and declarative.
-- =============================================================================

-- 0. Ensure required columns exist (safe idempotent guard)
alter table public.skill_trees
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true,
  add column if not exists is_active boolean not null default true;

alter table public.perk_nodes
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true,
  add column if not exists is_active boolean not null default true;

alter table public.perk_nodes
  alter column tree_id drop not null;

alter table public.weapons
  add column if not exists is_active boolean not null default true;

alter table public.compendium_keywords
  add column if not exists is_active boolean not null default true;

-- =============================================================================
-- 1. READ VIEWS (PRE-FILTERED & PRE-AGGREGATED IN POSTGRESQL)
-- =============================================================================

-- Active Weapons View
create or replace view public.v_active_weapons
with (security_invoker = true) as
select *
from public.weapons
where is_active = true
order by name asc;

-- Active Skill Trees View (with pre-computed node counts)
create or replace view public.v_active_skill_trees
with (security_invoker = true) as
select
  st.*,
  count(pn.id) filter (where pn.is_active = true)::int as active_node_count,
  count(pn.id) filter (where pn.is_active = true and pn.node_type = 'combat_art')::int as combat_art_count,
  count(pn.id) filter (where pn.is_active = true and pn.node_type = 'passive_upgrade')::int as passive_count
from public.skill_trees st
left join public.perk_nodes pn on pn.tree_id = st.id
where st.is_active = true
group by st.id
order by st.name asc;

-- Active Perk Nodes View (Tree Nodes + Standalone Arts)
create or replace view public.v_active_perk_nodes
with (security_invoker = true) as
select *
from public.perk_nodes
where is_active = true
order by tier asc, name asc;

-- Active Standalone Combat Arts & Passives View (No Skill Tree Prerequisite)
create or replace view public.v_active_standalone_arts
with (security_invoker = true) as
select *
from public.perk_nodes
where is_active = true
  and tree_id is null
order by name asc;

-- Active Glossary Keywords View
create or replace view public.v_active_keywords
with (security_invoker = true) as
select *
from public.compendium_keywords
where is_active = true
order by term asc;

grant select on public.v_active_weapons to authenticated, anon;
grant select on public.v_active_skill_trees to authenticated, anon;
grant select on public.v_active_perk_nodes to authenticated, anon;
grant select on public.v_active_standalone_arts to authenticated, anon;
grant select on public.v_active_keywords to authenticated, anon;

-- =============================================================================
-- 2. RPC: SINGLE-ROUNDTRIP COMPENDIUM BUNDLE
-- Gathers weapons, skill_trees, perk_nodes, and compendium_keywords on the
-- backend in one call instead of 4 separate client queries.
-- =============================================================================
create or replace function public.get_compendium_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'weapons', coalesce(
      (select jsonb_agg(w order by w.name asc) from public.weapons w),
      '[]'::jsonb
    ),
    'skillTrees', coalesce(
      (select jsonb_agg(t order by t.name asc) from public.skill_trees t),
      '[]'::jsonb
    ),
    'perkNodes', coalesce(
      (select jsonb_agg(p order by p.tier asc, p.name asc) from public.perk_nodes p),
      '[]'::jsonb
    ),
    'keywords', coalesce(
      (select jsonb_agg(k order by k.term asc) from public.compendium_keywords k),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.get_compendium_bundle() to authenticated, anon;

-- =============================================================================
-- 3. RPCs: ATOMIC SOFT-DELETE & SLUG ARCHIVING
-- Soft-deletes (is_active = false) and suffixes unique slugs inside a single
-- database transaction so existing character sheets keep their foreign keys
-- while freeing the original slug for future items.
-- =============================================================================

create or replace function public.soft_delete_skill_tree(p_tree_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  update public.skill_trees
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix
  where id = p_tree_id;

  update public.perk_nodes
  set
    is_active = false,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where tree_id = p_tree_id;
end;
$$;

create or replace function public.soft_delete_perk_node(p_node_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  update public.perk_nodes
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_node_id;
end;
$$;

create or replace function public.soft_delete_weapon(p_weapon_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  update public.weapons
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_weapon_id;
end;
$$;

grant execute on function public.soft_delete_skill_tree(uuid) to authenticated;
grant execute on function public.soft_delete_perk_node(uuid) to authenticated;
grant execute on function public.soft_delete_weapon(uuid) to authenticated;
