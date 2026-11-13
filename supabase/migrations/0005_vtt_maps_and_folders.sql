create table if not exists public.vtt_folders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scope text not null default 'maps' check (scope in ('maps', 'characters', 'npcs', 'items')),
  parent_folder_id uuid references public.vtt_folders(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_vtt_folders_campaign_scope
  on public.vtt_folders (campaign_id, scope, sort_order);

alter table public.vtt_folders enable row level security;

drop policy if exists "Authenticated users can view vtt folders" on public.vtt_folders;
create policy "Authenticated users can view vtt folders"
  on public.vtt_folders for select to authenticated
  using (true);

drop policy if exists "Campaign GM can manage vtt folders" on public.vtt_folders;
create policy "Campaign GM can manage vtt folders"
  on public.vtt_folders for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.campaigns c
      where c.id = vtt_folders.campaign_id
        and c.gm_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.campaigns c
      where c.id = vtt_folders.campaign_id
        and c.gm_id = auth.uid()
    )
  );

alter table public.vtt_encounters
  add column if not exists folder_id uuid references public.vtt_folders(id) on delete set null,
  add column if not exists grid_mode text not null default 'square' check (grid_mode in ('square', 'hex', 'gridless')),
  add column if not exists background_color text not null default '#0E1917',
  add column if not exists scene_width int,
  add column if not exists scene_height int,
  add column if not exists padding numeric(4,2) not null default 0.20,
  add column if not exists sort_order int not null default 0;

alter table public.vtt_encounters
  alter column grid_size_px set default 100;

alter table public.vtt_tokens
  add column if not exists world_x numeric(10,2),
  add column if not exists world_y numeric(10,2);

alter table public.vtt_folders replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.vtt_folders;
  exception when duplicate_object then
    null;
  end;
end $$;
