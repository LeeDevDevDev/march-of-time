-- ============================================================================
-- MARCH OF TIME — 0007 CUSTOM ICONS, COLORS & SUPABASE STORAGE BUCKET
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Add Icon & Color Columns to Skill Trees and Perk Nodes
alter table public.skill_trees
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true;

alter table public.perk_nodes
  add column if not exists icon text,
  add column if not exists icon_color text,
  add column if not exists icon_tint_custom boolean not null default true;

-- 2. Create Public `compendium-icons` Bucket in Supabase Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compendium-icons',
  'compendium-icons',
  true,
  2097152, -- 2 MB max per icon
  array['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage RLS Policies for `compendium-icons`
drop policy if exists "Public can view compendium icons" on storage.objects;
create policy "Public can view compendium icons"
  on storage.objects for select
  using (bucket_id = 'compendium-icons');

drop policy if exists "Authenticated users can upload compendium icons" on storage.objects;
create policy "Authenticated users can upload compendium icons"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'compendium-icons');

drop policy if exists "Authenticated users can update compendium icons" on storage.objects;
create policy "Authenticated users can update compendium icons"
  on storage.objects for update to authenticated
  using (bucket_id = 'compendium-icons')
  with check (bucket_id = 'compendium-icons');

drop policy if exists "Authenticated users can delete compendium icons" on storage.objects;
create policy "Authenticated users can delete compendium icons"
  on storage.objects for delete to authenticated
  using (bucket_id = 'compendium-icons');
