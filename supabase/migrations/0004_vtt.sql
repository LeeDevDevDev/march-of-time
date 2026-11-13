alter table public.vtt_encounters
  add column if not exists campaign_id uuid references public.campaigns(id) on delete cascade,
  add column if not exists is_active_scene boolean not null default true,
  add column if not exists map_image_url text,
  add column if not exists grid_size_px int not null default 64,
  add column if not exists grid_offset_x int not null default 0,
  add column if not exists grid_offset_y int not null default 0,
  add column if not exists grid_opacity numeric(3,2) not null default 0.35,
  add column if not exists fog_enabled boolean not null default true,
  add column if not exists global_illumination boolean not null default false,
  add column if not exists darkness_level numeric(3,2) not null default 0.85,
  add column if not exists walls jsonb not null default '[]'::jsonb,
  add column if not exists lights jsonb not null default '[]'::jsonb,
  add column if not exists explored_fog jsonb not null default '{}'::jsonb,
  add column if not exists combat_active boolean not null default false,
  add column if not exists active_turn_token_id uuid,
  add column if not exists initiative_order jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_vtt_encounters_campaign_id
  on public.vtt_encounters (campaign_id);

alter table public.vtt_tokens
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists q int not null default 0,
  add column if not exists r int not null default 0,
  add column if not exists size int not null default 1,
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists max_ap int not null default 4,
  add column if not exists move_feet int not null default 20,
  add column if not exists vision_feet int not null default 60,
  add column if not exists light_bright_feet int not null default 0,
  add column if not exists light_dim_feet int not null default 0,
  add column if not exists light_color text not null default '#FF9B42',
  add column if not exists shield_raised boolean not null default false,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists statuses jsonb not null default '[]'::jsonb,
  add column if not exists npc_stats jsonb not null default '{}'::jsonb;

create index if not exists idx_vtt_tokens_encounter_id
  on public.vtt_tokens (encounter_id);

create table if not exists public.vtt_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  encounter_id uuid references public.vtt_encounters(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text not null default 'System',
  kind text not null default 'roll' check (kind in ('roll', 'clash', 'damage', 'round', 'chat', 'system')),
  title text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_vtt_logs_campaign_created
  on public.vtt_logs (campaign_id, created_at desc);

alter table public.vtt_logs enable row level security;

drop policy if exists "Authenticated users can delete encounters" on public.vtt_encounters;
create policy "Authenticated users can delete encounters"
  on public.vtt_encounters for delete to authenticated
  using (auth.uid() = gm_id);

drop policy if exists "Campaign participants can view vtt logs" on public.vtt_logs;
create policy "Campaign participants can view vtt logs"
  on public.vtt_logs for select to authenticated
  using (true);

drop policy if exists "Campaign participants can insert vtt logs" on public.vtt_logs;
create policy "Campaign participants can insert vtt logs"
  on public.vtt_logs for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "GM can delete vtt logs" on public.vtt_logs;
create policy "GM can delete vtt logs"
  on public.vtt_logs for delete to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = vtt_logs.campaign_id
        and c.gm_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vtt-maps',
  'vtt-maps',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view vtt maps" on storage.objects;
create policy "Public can view vtt maps"
  on storage.objects for select
  using (bucket_id = 'vtt-maps');

drop policy if exists "Authenticated users can upload vtt maps" on storage.objects;
create policy "Authenticated users can upload vtt maps"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vtt-maps');

drop policy if exists "Authenticated users can update own vtt maps" on storage.objects;
create policy "Authenticated users can update own vtt maps"
  on storage.objects for update to authenticated
  using (bucket_id = 'vtt-maps' and owner = auth.uid());

drop policy if exists "Authenticated users can delete own vtt maps" on storage.objects;
create policy "Authenticated users can delete own vtt maps"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vtt-maps' and owner = auth.uid());

alter table public.vtt_encounters replica identity full;
alter table public.vtt_tokens replica identity full;
alter table public.vtt_logs replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.vtt_encounters;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.vtt_tokens;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.vtt_logs;
  exception when duplicate_object then
    null;
  end;
end $$;
