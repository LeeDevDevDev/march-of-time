-- =============================================================================
-- Migration 0009: Standalone ("Solo") Combat Arts & Passives
-- Self-contained migration: also ensures 0007 (icon columns) and 0008 (is_active)
-- columns exist so this script succeeds even if 0007/0008 were not run yet.
-- =============================================================================

-- 1. Ensure icon & color columns (from 0007) exist on skill_trees & perk_nodes
alter table public.skill_trees
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true;

alter table public.perk_nodes
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true;

-- 2. Ensure soft-archive `is_active` column (from 0008) exists across compendium tables
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

-- 3. Allow `perk_nodes.tree_id` to be NULL for Standalone ("Solo") Combat Arts & Passives
alter table public.perk_nodes
  alter column tree_id drop not null;

create index if not exists idx_perk_nodes_standalone
  on public.perk_nodes (node_type, name)
  where tree_id is null;

-- 4. Seed starter Standalone Combat Arts & Passives (idempotent by slug)
insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id,
  icon,
  icon_color,
  icon_tint_custom,
  is_official,
  is_active
)
values
  (
    null,
    'shield-bash',
    'Shield Bash',
    'combat_art',
    1,
    1,
    1,
    2,
    'Crushing',
    'Drive your shield or weapon guard into an adjacent foe, dealing +2 [SP] damage and inflicting [Staggered] on hit. Punishes [Shield Block].',
    '{"disallow_defense": ["Block"], "bonus_sp_damage": 2, "inflict_status": "Staggered", "__is_standalone": true, "__icon": "bastion-shield", "__icon_color": "#FF8C5A", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'bastion-shield',
    '#FF8C5A',
    true,
    true,
    true
  ),
  (
    null,
    'vanguard-cleave',
    'Vanguard Cleave',
    'combat_art',
    1,
    1,
    2,
    3,
    'Sweeping',
    'Swing in a wide horizontal arc that punishes [Dodge] attempts and deals +2 flat damage.',
    '{"disallow_defense": ["Dodge"], "bonus_flat_damage": 2, "__is_standalone": true, "__icon": "battleaxe", "__icon_color": "#F26464", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'battleaxe',
    '#F26464',
    true,
    true,
    true
  ),
  (
    null,
    'veterans-resolve',
    'Veteran''s Resolve',
    'passive_upgrade',
    1,
    1,
    null,
    null,
    'None',
    'Hardened battlefield conditioning grants +2 Max [SP] and +1 [Stance Recovery] when catching your breath.',
    '{"bonus_max_sp": 2, "bonus_stance_recovery": 1, "__is_standalone": true, "__icon": "iron-helm", "__icon_color": "#38B29A", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'iron-helm',
    '#38B29A',
    true,
    true,
    true
  )
on conflict (slug) do update set
  tree_id = excluded.tree_id,
  name = excluded.name,
  node_type = excluded.node_type,
  ap_cost = excluded.ap_cost,
  cooldown_rounds = excluded.cooldown_rounds,
  combat_tag = excluded.combat_tag,
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  icon = excluded.icon,
  icon_color = excluded.icon_color,
  icon_tint_custom = excluded.icon_tint_custom,
  is_active = excluded.is_active;
