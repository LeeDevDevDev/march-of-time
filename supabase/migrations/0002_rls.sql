create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

create or replace function public.protect_profile_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(
    auth.role(),
    current_setting('request.jwt.claim.role', true),
    ''
  );
begin
  if v_jwt_role in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      if new.is_admin is distinct from old.is_admin then
        raise exception 'Permission denied: is_admin cannot be modified from the client.'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_admin on public.profiles;
create trigger trg_protect_profile_admin
  before insert or update on public.profiles
  for each row execute function public.protect_profile_admin_column();

alter table public.profiles enable row level security;
alter table public.weapons enable row level security;
alter table public.skill_trees enable row level security;
alter table public.perk_nodes enable row level security;
alter table public.compendium_keywords enable row level security;
alter table public.characters enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.vtt_encounters enable row level security;
alter table public.vtt_tokens enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id and is_admin = false);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = coalesce(
      (select p.is_admin from public.profiles p where p.id = auth.uid()),
      false
    )
  );

drop policy if exists "Anyone can view official or own weapons" on public.weapons;
drop policy if exists "Everyone can view weapons" on public.weapons;
create policy "Everyone can view weapons"
  on public.weapons for select using (true);

drop policy if exists "Authenticated users can create custom weapons" on public.weapons;
drop policy if exists "Creators can update their custom weapons" on public.weapons;
drop policy if exists "Admins can insert weapons" on public.weapons;
drop policy if exists "Admins can update weapons" on public.weapons;
drop policy if exists "Admins can delete weapons" on public.weapons;

create policy "Admins can insert weapons"
  on public.weapons for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update weapons"
  on public.weapons for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete weapons"
  on public.weapons for delete to authenticated
  using (public.is_admin());

drop policy if exists "Skill trees are viewable by everyone" on public.skill_trees;
create policy "Skill trees are viewable by everyone"
  on public.skill_trees for select using (true);

drop policy if exists "Admins can insert skill trees" on public.skill_trees;
drop policy if exists "Admins can update skill trees" on public.skill_trees;
drop policy if exists "Admins can delete skill trees" on public.skill_trees;

create policy "Admins can insert skill trees"
  on public.skill_trees for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update skill trees"
  on public.skill_trees for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete skill trees"
  on public.skill_trees for delete to authenticated
  using (public.is_admin());

drop policy if exists "Perk nodes are viewable by everyone" on public.perk_nodes;
create policy "Perk nodes are viewable by everyone"
  on public.perk_nodes for select using (true);

drop policy if exists "Admins can insert perk nodes" on public.perk_nodes;
drop policy if exists "Admins can update perk nodes" on public.perk_nodes;
drop policy if exists "Admins can delete perk nodes" on public.perk_nodes;

create policy "Admins can insert perk nodes"
  on public.perk_nodes for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update perk nodes"
  on public.perk_nodes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete perk nodes"
  on public.perk_nodes for delete to authenticated
  using (public.is_admin());

drop policy if exists "Everyone can view compendium keywords" on public.compendium_keywords;
create policy "Everyone can view compendium keywords"
  on public.compendium_keywords for select using (true);

drop policy if exists "Admins can insert compendium keywords" on public.compendium_keywords;
drop policy if exists "Admins can update compendium keywords" on public.compendium_keywords;
drop policy if exists "Admins can delete compendium keywords" on public.compendium_keywords;

create policy "Admins can insert compendium keywords"
  on public.compendium_keywords for insert to authenticated
  with check (public.is_admin());

create policy "Admins can update compendium keywords"
  on public.compendium_keywords for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete compendium keywords"
  on public.compendium_keywords for delete to authenticated
  using (public.is_admin());

drop policy if exists "Characters viewable by authenticated users in VTT" on public.characters;
create policy "Characters viewable by authenticated users in VTT"
  on public.characters for select to authenticated using (true);

drop policy if exists "Owners can insert their own characters" on public.characters;
create policy "Owners can insert their own characters"
  on public.characters for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their own characters" on public.characters;
drop policy if exists "Owners and admins can update characters" on public.characters;
create policy "Owners and admins can update characters"
  on public.characters for update to authenticated
  using (auth.uid() = owner_id or public.is_admin())
  with check (auth.uid() = owner_id or public.is_admin());

drop policy if exists "Owners can delete their own characters" on public.characters;
create policy "Owners can delete their own characters"
  on public.characters for delete to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Authenticated users can view campaigns" on public.campaigns;
create policy "Authenticated users can view campaigns"
  on public.campaigns for select to authenticated using (true);

drop policy if exists "Users can create their own campaigns as GM" on public.campaigns;
create policy "Users can create their own campaigns as GM"
  on public.campaigns for insert to authenticated
  with check (auth.uid() = gm_id);

drop policy if exists "GMs can update their own campaigns" on public.campaigns;
create policy "GMs can update their own campaigns"
  on public.campaigns for update to authenticated
  using (auth.uid() = gm_id);

drop policy if exists "GMs can delete their own campaigns" on public.campaigns;
create policy "GMs can delete their own campaigns"
  on public.campaigns for delete to authenticated
  using (auth.uid() = gm_id);

drop policy if exists "Authenticated users can view campaign members" on public.campaign_members;
create policy "Authenticated users can view campaign members"
  on public.campaign_members for select to authenticated using (true);

drop policy if exists "Authenticated users can join a campaign" on public.campaign_members;
create policy "Authenticated users can join a campaign"
  on public.campaign_members for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can leave a campaign or GM can remove" on public.campaign_members;
create policy "Users can leave a campaign or GM can remove"
  on public.campaign_members for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can view encounters" on public.vtt_encounters;
create policy "Authenticated users can view encounters"
  on public.vtt_encounters for select to authenticated using (true);

drop policy if exists "Authenticated users can update encounters" on public.vtt_encounters;
create policy "Authenticated users can update encounters"
  on public.vtt_encounters for update to authenticated using (true);

drop policy if exists "Authenticated users can insert encounters" on public.vtt_encounters;
create policy "Authenticated users can insert encounters"
  on public.vtt_encounters for insert to authenticated
  with check (auth.uid() = gm_id);

drop policy if exists "Authenticated users can view tokens" on public.vtt_tokens;
create policy "Authenticated users can view tokens"
  on public.vtt_tokens for select to authenticated using (true);

drop policy if exists "Authenticated users can update tokens" on public.vtt_tokens;
create policy "Authenticated users can update tokens"
  on public.vtt_tokens for all to authenticated using (true);

drop policy if exists "Public can view compendium icons" on storage.objects;
create policy "Public can view compendium icons"
  on storage.objects for select
  using (bucket_id = 'compendium-icons');

drop policy if exists "Authenticated users can upload compendium icons" on storage.objects;
drop policy if exists "Authenticated users can update compendium icons" on storage.objects;
drop policy if exists "Authenticated users can delete compendium icons" on storage.objects;
drop policy if exists "Admins can upload compendium icons" on storage.objects;
drop policy if exists "Admins can update compendium icons" on storage.objects;
drop policy if exists "Admins can delete compendium icons" on storage.objects;

create policy "Admins can upload compendium icons"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'compendium-icons' and public.is_admin());

create policy "Admins can update compendium icons"
  on storage.objects for update to authenticated
  using (bucket_id = 'compendium-icons' and public.is_admin());

create policy "Admins can delete compendium icons"
  on storage.objects for delete to authenticated
  using (bucket_id = 'compendium-icons' and public.is_admin());

create or replace function public.soft_delete_skill_tree(p_tree_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: Admin privileges required.'
      using errcode = '42501';
  end if;

  update public.skill_trees
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix
  where id = p_tree_id;

  update public.perk_nodes
  set
    is_active = false,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where tree_id = p_tree_id;
end;
$$;

create or replace function public.soft_delete_perk_node(p_node_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: Admin privileges required.'
      using errcode = '42501';
  end if;

  update public.perk_nodes
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_node_id;
end;
$$;

create or replace function public.soft_delete_weapon(p_weapon_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_suffix text := '-archived-' || extract(epoch from now())::bigint::text;
begin
  if not public.is_admin() then
    raise exception 'Permission denied: Admin privileges required.'
      using errcode = '42501';
  end if;

  update public.weapons
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[0-9a-z]+$', '', 'i') || v_suffix,
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_weapon_id;
end;
$$;

grant execute on function public.soft_delete_skill_tree(uuid) to authenticated;
grant execute on function public.soft_delete_perk_node(uuid) to authenticated;
grant execute on function public.soft_delete_weapon(uuid) to authenticated;
