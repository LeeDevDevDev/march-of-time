create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  handle text unique,
  avatar_url text,
  is_admin boolean not null default false,
  sheet_theme text not null default 'light' check (sheet_theme in ('light', 'dark')),
  vtt_theme text not null default 'dark' check (vtt_theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format_check check (handle is null or handle ~ '^[a-z0-9_]{3,24}$')
);

alter table public.profiles
  add column if not exists handle text unique,
  add column if not exists is_admin boolean not null default false;

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
  rule_hooks jsonb not null default '{}'::jsonb,
  is_official boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.weapons
  add column if not exists is_active boolean not null default true;

create index if not exists idx_weapons_is_active on public.weapons (is_active);

create table if not exists public.skill_trees (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  icon text,
  icon_color text,
  icon_tint_custom boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.skill_trees
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_skill_trees_is_active on public.skill_trees (is_active);

create table if not exists public.perk_nodes (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid references public.skill_trees(id) on delete cascade,
  slug text unique not null,
  name text not null,
  node_type text not null check (node_type in ('combat_art', 'passive_upgrade')),
  tier int not null default 1 check (tier between 1 and 5),
  perk_cost int not null default 1,
  ap_cost int,
  cooldown_rounds int,
  combat_tag text check (combat_tag in ('Crushing', 'Sweeping', 'Piercing', 'None')),
  description text not null,
  rule_hooks jsonb not null default '{}'::jsonb,
  parent_node_id uuid references public.perk_nodes(id) on delete set null,
  icon text,
  icon_color text,
  icon_tint_custom boolean not null default true,
  is_official boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.perk_nodes
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true,
  add column if not exists is_active boolean not null default true;

alter table public.perk_nodes
  alter column tree_id drop not null;

create index if not exists idx_perk_nodes_is_active on public.perk_nodes (is_active);
create index if not exists idx_perk_nodes_standalone on public.perk_nodes (node_type, name) where tree_id is null;

create table if not exists public.compendium_keywords (
  id uuid primary key default gen_random_uuid(),
  term text unique not null,
  category text not null default 'Core Mechanic',
  summary text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compendium_keywords
  add column if not exists is_active boolean not null default true;

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Adventurer''s Character',
  level int not null default 1 check (level >= 1),
  attributes jsonb not null default '{"Brawn": 0, "Agility": 0, "Technique": 0, "Iron": 0, "Cunning": 0}'::jsonb,
  combat_skills jsonb not null default '{"Strike": 0, "Shoot": 0, "Parry": 0, "Dodge": 0, "Block": 0}'::jsonb,
  field_skills jsonb not null default '{"Athletics": 0, "Menace": 0, "Stealth": 0, "Tinkering": 0, "Medicine": 0, "Survival": 0, "Resolve": 0, "Perception": 0, "Sway": 0, "Lore": 0}'::jsonb,
  equipped_armor text not null default 'None' check (equipped_armor in ('None', 'Light', 'Medium', 'Heavy')),
  equipped_shield text not null default 'None' check (equipped_shield in ('None', 'Buckler', 'Heater', 'Tower')),
  weapon_slot_1_id uuid references public.weapons(id) on delete set null,
  weapon_slot_2_id uuid references public.weapons(id) on delete set null,
  active_weapon_slot int not null default 1 check (active_weapon_slot in (1, 2)),
  unlocked_perk_ids uuid[] not null default '{}',
  current_hp int not null default 5,
  current_sp int not null default 10,
  current_ap int not null default 4 check (current_ap between 0 and 6),
  active_cooldowns jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cover_image_url text,
  gm_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  last_played_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create table if not exists public.vtt_encounters (
  id uuid primary key default gen_random_uuid(),
  gm_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Tactical Skirmish',
  grid_width int not null default 12,
  grid_height int not null default 8,
  round_number int not null default 1,
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compendium-icons',
  'compendium-icons',
  true,
  2097152,
  array['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace view public.v_active_weapons
with (security_invoker = true) as
select *
from public.weapons
where is_active = true
order by name asc;

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

create or replace view public.v_active_perk_nodes
with (security_invoker = true) as
select *
from public.perk_nodes
where is_active = true
order by tier asc, name asc;

create or replace view public.v_active_standalone_arts
with (security_invoker = true) as
select *
from public.perk_nodes
where is_active = true
  and tree_id is null
order by name asc;

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
