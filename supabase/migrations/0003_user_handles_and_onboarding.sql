-- ============================================================================
-- MARCH OF TIME — 0003 USER HANDLES (@handle) & GOOGLE ONBOARDING
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- 1. Add unique handle column to public.profiles (nullable until onboarding completes)
alter table public.profiles
  add column if not exists handle text unique;

-- Enforce lowercase alphanumeric + underscore handles (3 to 24 chars)
alter table public.profiles
  drop constraint if exists profiles_handle_format_check;

alter table public.profiles
  add constraint profiles_handle_format_check
  check (handle is null or handle ~ '^[a-z0-9_]{3,24}$');

-- 2. Update the new-user trigger so Email sign-ups with a handle save it immediately,
-- while Google OAuth sign-ins leave handle NULL so the app triggers the Onboarding screen.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, handle, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Adventurer'),
    nullif(lower(trim(new.raw_user_meta_data->>'handle')), ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    handle = coalesce(public.profiles.handle, excluded.handle);
  return new;
end;
$$;
