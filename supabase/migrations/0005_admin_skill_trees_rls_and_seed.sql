-- ============================================================================
-- MARCH OF TIME — 0005 ADMIN CONTENT MANAGER RLS & EXPANDED SKILL TREES
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Ensure is_admin exists on public.profiles and grant admin to existing users
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = true;

-- 2. Allow authenticated users / admins to insert, update, and delete Skill Trees
drop policy if exists "Admins can insert skill trees" on public.skill_trees;
create policy "Admins can insert skill trees"
  on public.skill_trees for insert to authenticated
  with check (true);

drop policy if exists "Admins can update skill trees" on public.skill_trees;
create policy "Admins can update skill trees"
  on public.skill_trees for update to authenticated
  using (true) with check (true);

drop policy if exists "Admins can delete skill trees" on public.skill_trees;
create policy "Admins can delete skill trees"
  on public.skill_trees for delete to authenticated
  using (true);

-- 3. Allow authenticated users / admins to insert, update, and delete Perk Nodes & Combat Arts
drop policy if exists "Admins can insert perk nodes" on public.perk_nodes;
create policy "Admins can insert perk nodes"
  on public.perk_nodes for insert to authenticated
  with check (true);

drop policy if exists "Admins can update perk nodes" on public.perk_nodes;
create policy "Admins can update perk nodes"
  on public.perk_nodes for update to authenticated
  using (true) with check (true);

drop policy if exists "Admins can delete perk nodes" on public.perk_nodes;
create policy "Admins can delete perk nodes"
  on public.perk_nodes for delete to authenticated
  using (true);

-- 4. Seed Multi-Tier Combat Arts & Passive Upgrades across the 3 Official Skill Trees
-- PATH OF THE BREAKER (juggernaut)
insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'helm-splitter', 'Helm Splitter', 'combat_art', 1, 1, 2, 3, 'Crushing',
  'Overhead Crushing blow that cannot be Parried (target must Dodge or Shield Block) and deals +2 bonus SP damage.',
  '{"disallow_defense": ["Parry"], "bonus_sp_damage": 2}'::jsonb
from public.skill_trees where slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'ironblood-conditioning', 'Ironblood Conditioning', 'passive_upgrade', 1, 1, null, null, 'None',
  'Hardened posture and dense muscle fibers permanently grant +2 Max HP and +2 Max SP.',
  '{"bonus_max_hp": 2, "bonus_max_sp": 2}'::jsonb
from public.skill_trees where slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks, parent_node_id)
select
  t.id,
  'sundering-ram',
  'Sundering Ram',
  'combat_art',
  2,
  1,
  2,
  3,
  'Crushing',
  'Drive through the enemy''s guard: a Crushing charge that cannot be Parried, pushes the target 1 Tile, and inflicts Sundered.',
  '{"disallow_defense": ["Parry"], "push_tiles": 1, "inflict_status": "Sundered"}'::jsonb,
  (select id from public.perk_nodes where slug = 'helm-splitter' limit 1)
from public.skill_trees t where t.slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks, parent_node_id)
select
  t.id,
  'colossus-grip',
  'Colossus Grip',
  'passive_upgrade',
  2,
  1,
  null,
  null,
  'None',
  'Unrelenting leverage grants +1 Flat Weapon Damage and +1 Shield Block reinforcement.',
  '{"bonus_flat_damage": 1, "bonus_block_mod": 1}'::jsonb,
  (select id from public.perk_nodes where slug = 'ironblood-conditioning' limit 1)
from public.skill_trees t where t.slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

-- PATH OF THE VEIL (phantom)
insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'phantom-step', 'Phantom Step', 'combat_art', 1, 1, 1, 2, 'Piercing',
  'Shift 1 Tile and deliver a Piercing lunge that cannot be Shield Blocked (target must Parry or Dodge).',
  '{"disallow_defense": ["Block"], "self_shift_tiles": 1}'::jsonb
from public.skill_trees where slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'quicksilver-reflexes', 'Quicksilver Reflexes', 'passive_upgrade', 1, 1, null, null, 'None',
  'Razor-sharp footwork grants +1 to Dodge rolls and +2 Max SP.',
  '{"bonus_dodge_mod": 1, "bonus_max_sp": 2}'::jsonb
from public.skill_trees where slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks, parent_node_id)
select
  t.id,
  'heartseeker-thrust',
  'Heartseeker Thrust',
  'combat_art',
  2,
  1,
  2,
  3,
  'Piercing',
  'Precision Piercing needle strike that cannot be Shield Blocked, pierces 2 Armor DR, and inflicts Bleeding.',
  '{"disallow_defense": ["Block"], "ignore_armor_dr": 2, "inflict_status": "Bleeding"}'::jsonb,
  (select id from public.perk_nodes where slug = 'phantom-step' limit 1)
from public.skill_trees t where t.slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks, parent_node_id)
select
  t.id,
  'duelist-riposte',
  'Duelist''s Riposte',
  'passive_upgrade',
  2,
  1,
  null,
  null,
  'None',
  'Refined blade geometry grants +1 to Parry rolls and +1 to Attack Rolls.',
  '{"bonus_parry_mod": 1, "bonus_attack_mod": 1}'::jsonb,
  (select id from public.perk_nodes where slug = 'quicksilver-reflexes' limit 1)
from public.skill_trees t where t.slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

-- PATH OF THE GALE (tempest)
insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'crescent-sweep', 'Crescent Sweep', 'combat_art', 1, 1, 2, 3, 'Sweeping',
  'Wide horizontal Sweeping arc that cannot be Dodged (target must Parry or Shield Block) and deals +2 SP damage.',
  '{"disallow_defense": ["Dodge"], "bonus_sp_damage": 2}'::jsonb
from public.skill_trees where slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'windrunner-stride', 'Windrunner Stride', 'passive_upgrade', 1, 1, null, null, 'None',
  'Effortless momentum increases your movement by +1 Tile (+5 ft) per 1 AP spent moving.',
  '{"bonus_move_tiles": 1}'::jsonb
from public.skill_trees where slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks, parent_node_id)
select
  t.id,
  'cyclone-reap',
  'Cyclone Reap',
  'combat_art',
  2,
  1,
  2,
  3,
  'Sweeping',
  'Spinning Sweeping scythe-cut that cannot be Dodged, pushes adjacent foes 1 Tile, and inflicts Staggered.',
  '{"disallow_defense": ["Dodge"], "push_tiles": 1, "inflict_status": "Staggered"}'::jsonb,
  (select id from public.perk_nodes where slug = 'crescent-sweep' limit 1)
from public.skill_trees t where t.slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;
