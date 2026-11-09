-- ============================================================================
-- MARCH OF TIME — 0002 GAMES / CAMPAIGNS DASHBOARD SCHEMA
-- Run this in your Supabase SQL Editor to enable "Your Games" & "Games You Are In"
-- ============================================================================

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

alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;

-- Campaigns policies
create policy "Authenticated users can view campaigns"
  on public.campaigns for select to authenticated using (true);

create policy "Users can create their own campaigns as GM"
  on public.campaigns for insert to authenticated with check (auth.uid() = gm_id);

create policy "GMs can update their own campaigns"
  on public.campaigns for update to authenticated using (auth.uid() = gm_id);

create policy "GMs can delete their own campaigns"
  on public.campaigns for delete to authenticated using (auth.uid() = gm_id);

-- Campaign Members policies
create policy "Authenticated users can view campaign members"
  on public.campaign_members for select to authenticated using (true);

create policy "Authenticated users can join a campaign"
  on public.campaign_members for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can leave a campaign or GM can remove"
  on public.campaign_members for delete to authenticated using (auth.uid() = user_id);
