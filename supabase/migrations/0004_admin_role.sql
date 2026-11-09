-- ============================================================================
-- MARCH OF TIME — 0004 ADMIN ROLE FOR CONTENT MANAGER
-- Run this in your Supabase SQL Editor
-- ============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Make existing user profiles admins so your account can access Content Manager
update public.profiles
set is_admin = true;
