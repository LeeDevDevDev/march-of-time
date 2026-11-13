create table if not exists public.vtt_roster_actors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  folder_id uuid references public.vtt_folders(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  collection_actor_id uuid,
  owner_id uuid references public.profiles(id) on delete set null,
  actor_kind text not null default 'character' check (actor_kind in ('character', 'npc')),
  is_unique boolean not null default true,
  name text not null,
  faction text not null default 'ally' check (faction in ('ally', 'enemy', 'neutral')),
  size int not null default 1,
  icon text,
  color text,
  max_hp int not null default 10,
  max_sp int not null default 5,
  max_ap int not null default 4,
  armor_dr int not null default 0,
  shield_block int not null default 0,
  move_feet int not null default 20,
  vision_feet int not null default 60,
  light_bright_feet int not null default 0,
  light_dim_feet int not null default 0,
  light_color text not null default '#F59E0B',
  npc_stats jsonb not null default '{}'::jsonb,
  notes text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vtt_roster_actors_campaign_folder
  on public.vtt_roster_actors (campaign_id, folder_id, sort_order);

alter table public.vtt_roster_actors enable row level security;

drop policy if exists "Authenticated users can view vtt roster actors" on public.vtt_roster_actors;
create policy "Authenticated users can view vtt roster actors"
  on public.vtt_roster_actors for select to authenticated
  using (true);

drop policy if exists "Campaign GM or owner can insert vtt roster actors" on public.vtt_roster_actors;
create policy "Campaign GM or owner can insert vtt roster actors"
  on public.vtt_roster_actors for insert to authenticated
  with check (
    public.is_admin()
    or owner_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = vtt_roster_actors.campaign_id
        and c.gm_id = auth.uid()
    )
  );

drop policy if exists "Campaign GM or owner can update vtt roster actors" on public.vtt_roster_actors;
create policy "Campaign GM or owner can update vtt roster actors"
  on public.vtt_roster_actors for update to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = vtt_roster_actors.campaign_id
        and c.gm_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or owner_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = vtt_roster_actors.campaign_id
        and c.gm_id = auth.uid()
    )
  );

drop policy if exists "Campaign GM or owner can delete vtt roster actors" on public.vtt_roster_actors;
create policy "Campaign GM or owner can delete vtt roster actors"
  on public.vtt_roster_actors for delete to authenticated
  using (
    public.is_admin()
    or owner_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = vtt_roster_actors.campaign_id
        and c.gm_id = auth.uid()
    )
  );

alter table public.vtt_roster_actors replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.vtt_roster_actors;
  exception when duplicate_object then
    null;
  end;
end $$;

create table if not exists public.collection_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  parent_folder_id uuid references public.collection_folders(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_collection_folders_owner
  on public.collection_folders (owner_id, sort_order);

alter table public.collection_folders enable row level security;

drop policy if exists "Users can manage own collection folders" on public.collection_folders;
create policy "Users can manage own collection folders"
  on public.collection_folders for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

create table if not exists public.collection_actors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.collection_folders(id) on delete set null,
  source_character_id uuid references public.characters(id) on delete set null,
  actor_kind text not null default 'character' check (actor_kind in ('character', 'npc')),
  is_unique boolean not null default true,
  name text not null,
  faction text not null default 'ally' check (faction in ('ally', 'enemy', 'neutral')),
  size int not null default 1,
  icon text,
  color text,
  max_hp int not null default 10,
  max_sp int not null default 5,
  max_ap int not null default 4,
  armor_dr int not null default 0,
  shield_block int not null default 0,
  move_feet int not null default 20,
  vision_feet int not null default 60,
  light_bright_feet int not null default 0,
  light_dim_feet int not null default 0,
  light_color text not null default '#F59E0B',
  npc_stats jsonb not null default '{}'::jsonb,
  notes text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collection_actors_owner_folder
  on public.collection_actors (owner_id, folder_id, sort_order);

alter table public.collection_actors enable row level security;

drop policy if exists "Users can manage own collection actors" on public.collection_actors;
create policy "Users can manage own collection actors"
  on public.collection_actors for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());
