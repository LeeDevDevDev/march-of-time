-- ============================================================================
-- MARCH OF TIME TTRPG — INITIAL SUPABASE SCHEMA & PLAYTEST SEED
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1. USER PROFILES (Synced automatically with Supabase Auth Email / Google)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  avatar_url text,
  sheet_theme text not null default 'light' check (sheet_theme in ('light', 'dark')),
  vtt_theme text not null default 'dark' check (vtt_theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Trigger to auto-create profile on Email or Google sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Chronicle Warden'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. CONTENT & RULE FORGE: WEAPONS COMPENDIUM
-- ============================================================================
create table if not exists public.weapons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null default 'Martial',
  ap_cost int not null default 1 check (ap_cost between 1 and 4),
  requires_aim boolean not null default false,
  gov_attribute text not null check (gov_attribute in ('Brawn', 'Agility', 'Technique', 'Iron', 'Cunning')),
  gov_skill text not null default 'Strike' check (gov_skill in ('Strike', 'Shoot')),
  base_damage int not null default 4,
  reach_tiles int not null default 1,
  thrown_range_tiles int,
  trait_name text not null,
  trait_description text not null,
  -- Structured rule hooks for non-agnostic VTT & sheet automation
  rule_hooks jsonb not null default '{}'::jsonb,
  is_official boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.weapons enable row level security;

create policy "Anyone can view official or own weapons"
  on public.weapons for select using (is_official = true or auth.uid() = created_by);

create policy "Authenticated users can create custom weapons"
  on public.weapons for insert to authenticated with check (auth.uid() = created_by);

create policy "Creators can update their custom weapons"
  on public.weapons for update to authenticated using (auth.uid() = created_by);

-- ============================================================================
-- 3. SKILL TREES & PERK NODES (COMBAT ARTS + PASSIVE UPGRADES)
-- ============================================================================
create table if not exists public.skill_trees (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.perk_nodes (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.skill_trees(id) on delete cascade,
  slug text unique not null,
  name text not null,
  node_type text not null check (node_type in ('combat_art', 'passive_upgrade')),
  tier int not null default 1 check (tier between 1 and 5),
  perk_cost int not null default 1,
  ap_cost int,
  cooldown_rounds int,
  -- Defense Triangle Tag: Crushing (No Parry), Sweeping (No Dodge), Piercing (No Block)
  combat_tag text check (combat_tag in ('Crushing', 'Sweeping', 'Piercing', 'None')),
  description text not null,
  rule_hooks jsonb not null default '{}'::jsonb,
  parent_node_id uuid references public.perk_nodes(id) on delete set null,
  is_official boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.skill_trees enable row level security;
alter table public.perk_nodes enable row level security;

create policy "Skill trees are viewable by everyone" on public.skill_trees for select using (true);
create policy "Perk nodes are viewable by everyone" on public.perk_nodes for select using (true);

-- ============================================================================
-- 4. CHARACTER SHEETS
-- ============================================================================
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Unnamed Warden',
  level int not null default 1 check (level >= 1),
  -- 5 Core Attributes
  attributes jsonb not null default '{"Brawn": 0, "Agility": 0, "Technique": 0, "Iron": 0, "Cunning": 0}'::jsonb,
  -- 4 Combat Skills
  combat_skills jsonb not null default '{"Strike": 0, "Shoot": 0, "Parry": 0, "Dodge": 0}'::jsonb,
  -- 10 Field Skills (ranks)
  field_skills jsonb not null default '{"Athletics": 0, "Menace": 0, "Stealth": 0, "Tinkering": 0, "Medicine": 0, "Survival": 0, "Resolve": 0, "Perception": 0, "Sway": 0, "Lore": 0}'::jsonb,
  -- Equipment & Active 2-Weapon Loadout
  equipped_armor text not null default 'None' check (equipped_armor in ('None', 'Light', 'Medium', 'Heavy')),
  equipped_shield text not null default 'None' check (equipped_shield in ('None', 'Buckler', 'Heater', 'Tower')),
  weapon_slot_1_id uuid references public.weapons(id) on delete set null,
  weapon_slot_2_id uuid references public.weapons(id) on delete set null,
  active_weapon_slot int not null default 1 check (active_weapon_slot in (1, 2)),
  unlocked_perk_ids uuid[] not null default '{}',
  -- Live Combat Vitals & Unified 4-AP Round Pool
  current_hp int not null default 5,
  current_sp int not null default 10,
  current_ap int not null default 4 check (current_ap between 0 and 6),
  active_cooldowns jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy "Characters viewable by authenticated users in VTT"
  on public.characters for select to authenticated using (true);

create policy "Owners can insert their own characters"
  on public.characters for insert to authenticated with check (auth.uid() = owner_id);

create policy "Owners can update their own characters"
  on public.characters for update to authenticated using (auth.uid() = owner_id);

create policy "Owners can delete their own characters"
  on public.characters for delete to authenticated using (auth.uid() = owner_id);

-- ============================================================================
-- 5. VTT ENCOUNTERS, TOKENS & CONTESTED CLASH LOG
-- ============================================================================
create table if not exists public.vtt_encounters (
  id uuid primary key default gen_random_uuid(),
  gm_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Tactical Skirmish',
  grid_width int not null default 12,
  grid_height int not null default 8,
  round_number int not null default 1,
  -- Active pre-roll declaration prompt state (Attacker -> Defender must declare Parry/Dodge/Block before roll)
  pending_clash jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vtt_tokens (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.vtt_encounters(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  name text not null,
  faction text not null default 'ally' check (faction in ('ally', 'enemy', 'neutral')),
  x int not null default 1,
  y int not null default 1,
  current_hp int not null default 5,
  max_hp int not null default 5,
  current_sp int not null default 10,
  max_sp int not null default 10,
  current_ap int not null default 4,
  armor_dr int not null default 0,
  shield_block int not null default 0
);

alter table public.vtt_encounters enable row level security;
alter table public.vtt_tokens enable row level security;

create policy "Authenticated users can view encounters" on public.vtt_encounters for select to authenticated using (true);
create policy "Authenticated users can update encounters" on public.vtt_encounters for update to authenticated using (true);
create policy "Authenticated users can insert encounters" on public.vtt_encounters for insert to authenticated with check (auth.uid() = gm_id);

create policy "Authenticated users can view tokens" on public.vtt_tokens for select to authenticated using (true);
create policy "Authenticated users can update tokens" on public.vtt_tokens for all to authenticated using (true);

-- ============================================================================
-- 6. SEED DATA FROM mot-playtest.xlsx (7 WEAPONS & 3 COMBAT ARTS)
-- ============================================================================
insert into public.weapons (slug, name, category, ap_cost, requires_aim, gov_attribute, gov_skill, base_damage, reach_tiles, thrown_range_tiles, trait_name, trait_description, rule_hooks, is_official)
values
  ('greatsword', 'Greatsword', 'Heavy', 2, false, 'Brawn', 'Strike', 8, 1, null, 'Cleaving', 'Costs 2 AP; still deals 3 SP damage even if Parried.', '{"on_parried_sp_damage": 3}', true),
  ('warhammer', 'Warhammer', 'Heavy', 2, false, 'Brawn', 'Strike', 7, 1, null, 'Armor Breaker', 'Costs 2 AP; ignores 2 Armor.', '{"ignore_armor_dr": 2}', true),
  ('dagger', 'Dagger', 'Light', 1, false, 'Agility', 'Strike', 2, 1, 4, 'Quick-Draw', 'Can be thrown (4 tiles) without Aim; deals double damage vs targets at 0 SP.', '{"zero_sp_damage_multiplier": 2, "free_throw_range": 4}', true),
  ('rapier', 'Rapier', 'Martial', 1, false, 'Agility', 'Strike', 3, 1, null, 'Defensive Balance', 'Grants +1 bonus to Parry rolls while wielded.', '{"parry_roll_bonus": 1}', true),
  ('longsword', 'Longsword', 'Martial', 1, false, 'Technique', 'Strike', 5, 1, null, 'Versatile', 'Inflicts +2 bonus SP damage to the attacker on a Flawless Parry.', '{"flawless_parry_bonus_sp_damage": 2}', true),
  ('spear', 'Spear', 'Martial', 1, false, 'Technique', 'Strike', 4, 2, null, 'Reach 2 Tiles', 'Attack from 2 tiles away; prevents enemy flanking unless adjacent.', '{"reach_tiles": 2, "prevent_flank_unless_adjacent": true}', true),
  ('shortbow', 'Shortbow', 'Ranged', 1, true, 'Technique', 'Shoot', 4, 8, null, 'Unwieldy (Aim)', 'Requires 1 AP Aim before shooting, or Snap-Shoot at 1 Disadvantage.', '{"requires_aim_ap": 1, "snap_shoot_disadvantage": 1}', true)
on conflict (slug) do nothing;

insert into public.skill_trees (slug, name, description)
values
  ('juggernaut', 'Path of the Breaker', 'Heavy posture-shattering techniques and [Crushing] blows that overwhelm blade parries.'),
  ('phantom', 'Path of the Veil', 'High-mobility footwork, [Piercing] thrusts that bypass shields, and precision counters.'),
  ('tempest', 'Path of the Gale', 'Wide-arc [Sweeping] area control and multi-target zone denial.')
on conflict (slug) do nothing;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'helm-splitter', 'Helm Splitter', 'combat_art', 1, 1, 2, 3, 'Crushing', 'Cannot be Parried (target must Dodge or Shield Block).', '{"disallow_defense": ["Parry"]}'::jsonb
from public.skill_trees where slug = 'juggernaut'
on conflict (slug) do nothing;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'phantom-step', 'Phantom Step', 'combat_art', 1, 1, 1, 2, 'Piercing', 'Cannot be Shield Blocked (target must Parry or Dodge).', '{"disallow_defense": ["Block"]}'::jsonb
from public.skill_trees where slug = 'phantom'
on conflict (slug) do nothing;

insert into public.perk_nodes (tree_id, slug, name, node_type, tier, perk_cost, ap_cost, cooldown_rounds, combat_tag, description, rule_hooks)
select id, 'crescent-sweep', 'Crescent Sweep', 'combat_art', 1, 1, 2, 3, 'Sweeping', 'Cannot be Dodged (target must Parry or Shield Block).', '{"disallow_defense": ["Dodge"]}'::jsonb
from public.skill_trees where slug = 'tempest'
on conflict (slug) do nothing;
