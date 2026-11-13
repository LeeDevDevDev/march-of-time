insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-assets',
  'user-assets',
  true,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view user assets" on storage.objects;
create policy "Public can view user assets"
  on storage.objects for select
  using (bucket_id = 'user-assets');

drop policy if exists "Users can upload to own user-assets folder" on storage.objects;
create policy "Users can upload to own user-assets folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own user-assets folder" on storage.objects;
create policy "Users can update own user-assets folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own user-assets folder" on storage.objects;
create policy "Users can delete own user-assets folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.user_asset_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  parent_folder_id uuid references public.user_asset_folders(id) on delete cascade,
  name text not null,
  slug text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_asset_folders_owner
  on public.user_asset_folders (owner_id, sort_order);

alter table public.user_asset_folders enable row level security;

drop policy if exists "Users can manage own asset folders" on public.user_asset_folders;
create policy "Users can manage own asset folders"
  on public.user_asset_folders for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

create table if not exists public.user_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  folder_id uuid references public.user_asset_folders(id) on delete set null,
  name text not null,
  storage_bucket text not null default 'user-assets',
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_assets_owner_folder
  on public.user_assets (owner_id, folder_id, created_at desc);

alter table public.user_assets enable row level security;

drop policy if exists "Users can manage own assets" on public.user_assets;
create policy "Users can manage own assets"
  on public.user_assets for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());

create table if not exists public.user_asset_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  maps_folder_id uuid references public.user_asset_folders(id) on delete set null,
  characters_folder_id uuid references public.user_asset_folders(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_asset_preferences enable row level security;

drop policy if exists "Users can manage own asset preferences" on public.user_asset_preferences;
create policy "Users can manage own asset preferences"
  on public.user_asset_preferences for all to authenticated
  using (public.is_admin() or owner_id = auth.uid())
  with check (public.is_admin() or owner_id = auth.uid());
