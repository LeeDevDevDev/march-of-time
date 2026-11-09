-- =============================================================================
-- Migration 0008: Compendium Soft Delete (`is_active` Archive / Restore Status)
-- =============================================================================
-- Adds `is_active boolean not null default true` to all Compendium catalog
-- tables (`weapons`, `skill_trees`, `perk_nodes`, `compendium_keywords`) so
-- admins can Archive (soft-delete) and Restore items without breaking existing
-- player character sheets that reference them.
-- =============================================================================

alter table public.weapons
  add column if not exists is_active boolean not null default true;

alter table public.skill_trees
  add column if not exists is_active boolean not null default true;

alter table public.perk_nodes
  add column if not exists is_active boolean not null default true;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'compendium_keywords'
  ) then
    alter table public.compendium_keywords
      add column if not exists is_active boolean not null default true;
  end if;
end $$;

create index if not exists idx_weapons_is_active
  on public.weapons (is_active);

create index if not exists idx_skill_trees_is_active
  on public.skill_trees (is_active);

create index if not exists idx_perk_nodes_is_active
  on public.perk_nodes (is_active);
