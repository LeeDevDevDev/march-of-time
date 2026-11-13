alter table public.vtt_tokens
  add column if not exists created_at timestamptz not null default now();

create or replace function public.is_campaign_gm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.campaigns c
      where c.id = p_campaign_id
        and c.gm_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.is_campaign_participant(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_admin()
    or exists (
      select 1
      from public.campaigns c
      where c.id = p_campaign_id
        and c.gm_id = auth.uid()
    )
    or exists (
      select 1
      from public.campaign_members cm
      where cm.campaign_id = p_campaign_id
        and cm.user_id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.is_campaign_gm(uuid) to authenticated;
grant execute on function public.is_campaign_participant(uuid) to authenticated;

create or replace function public.is_handle_available(
  p_handle text,
  p_exclude_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles p
    where lower(p.handle) = lower(trim(coalesce(p_handle, '')))
      and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  );
$$;

grant execute on function public.is_handle_available(text, uuid) to authenticated, anon;

drop policy if exists "Users can leave a campaign or GM can remove" on public.campaign_members;
create policy "Users can leave a campaign or GM can remove"
  on public.campaign_members for delete to authenticated
  using (
    auth.uid() = user_id
    or public.is_campaign_gm(campaign_id)
  );

drop policy if exists "Authenticated users can view encounters" on public.vtt_encounters;
create policy "Authenticated users can view encounters"
  on public.vtt_encounters for select to authenticated
  using (
    campaign_id is null
    or public.is_campaign_participant(campaign_id)
  );

drop policy if exists "Authenticated users can update encounters" on public.vtt_encounters;
create policy "Authenticated users can update encounters"
  on public.vtt_encounters for update to authenticated
  using (
    (campaign_id is null and auth.uid() = gm_id)
    or (campaign_id is not null and public.is_campaign_participant(campaign_id))
  )
  with check (
    (campaign_id is null and auth.uid() = gm_id)
    or (campaign_id is not null and public.is_campaign_participant(campaign_id))
  );

drop policy if exists "Authenticated users can insert encounters" on public.vtt_encounters;
create policy "Authenticated users can insert encounters"
  on public.vtt_encounters for insert to authenticated
  with check (
    public.is_admin()
    or (
      auth.uid() = gm_id
      and (campaign_id is null or public.is_campaign_gm(campaign_id))
    )
  );

drop policy if exists "Authenticated users can delete encounters" on public.vtt_encounters;
create policy "Authenticated users can delete encounters"
  on public.vtt_encounters for delete to authenticated
  using (
    auth.uid() = gm_id
    or (campaign_id is not null and public.is_campaign_gm(campaign_id))
  );

drop policy if exists "Authenticated users can view tokens" on public.vtt_tokens;
create policy "Authenticated users can view tokens"
  on public.vtt_tokens for select to authenticated
  using (
    exists (
      select 1
      from public.vtt_encounters e
      where e.id = vtt_tokens.encounter_id
        and (e.campaign_id is null or public.is_campaign_participant(e.campaign_id))
    )
  );

drop policy if exists "Authenticated users can update tokens" on public.vtt_tokens;
drop policy if exists "Campaign participants can manage tokens" on public.vtt_tokens;
create policy "Campaign participants can manage tokens"
  on public.vtt_tokens for all to authenticated
  using (
    exists (
      select 1
      from public.vtt_encounters e
      where e.id = vtt_tokens.encounter_id
        and (e.campaign_id is null or public.is_campaign_participant(e.campaign_id))
    )
  )
  with check (
    exists (
      select 1
      from public.vtt_encounters e
      where e.id = vtt_tokens.encounter_id
        and (e.campaign_id is null or public.is_campaign_participant(e.campaign_id))
    )
  );

drop policy if exists "Campaign participants can view vtt logs" on public.vtt_logs;
create policy "Campaign participants can view vtt logs"
  on public.vtt_logs for select to authenticated
  using (public.is_campaign_participant(campaign_id));

drop policy if exists "Campaign participants can insert vtt logs" on public.vtt_logs;
create policy "Campaign participants can insert vtt logs"
  on public.vtt_logs for insert to authenticated
  with check (
    auth.uid() is not null
    and public.is_campaign_participant(campaign_id)
  );

drop policy if exists "Authenticated users can view vtt folders" on public.vtt_folders;
create policy "Authenticated users can view vtt folders"
  on public.vtt_folders for select to authenticated
  using (public.is_campaign_participant(campaign_id));

drop policy if exists "Authenticated users can view vtt roster actors" on public.vtt_roster_actors;
create policy "Authenticated users can view vtt roster actors"
  on public.vtt_roster_actors for select to authenticated
  using (public.is_campaign_participant(campaign_id));

create or replace view public.v_user_campaigns
with (security_invoker = true) as
select
  c.*,
  case
    when c.gm_id = auth.uid() then 'gm'
    else 'player'
  end as membership_role,
  (
    select count(*)::int
    from public.campaign_members cm
    where cm.campaign_id = c.id
  ) as member_count,
  (
    select count(*)::int
    from public.vtt_encounters e
    where e.campaign_id = c.id
  ) as scene_count
from public.campaigns c
where c.gm_id = auth.uid()
   or exists (
     select 1
     from public.campaign_members cm
     where cm.campaign_id = c.id
       and cm.user_id = auth.uid()
   );

create or replace view public.v_vtt_campaign_scenes
with (security_invoker = true) as
select
  e.*,
  (
    select count(*)::int
    from public.vtt_tokens t
    where t.encounter_id = e.id
  ) as token_count
from public.vtt_encounters e;

create or replace view public.v_visible_vtt_tokens
with (security_invoker = true) as
select t.*
from public.vtt_tokens t
join public.vtt_encounters e on e.id = t.encounter_id
where not coalesce(t.is_hidden, false)
   or t.owner_id = auth.uid()
   or (
     t.character_id is not null
     and exists (
       select 1
       from public.characters ch
       where ch.id = t.character_id
         and ch.owner_id = auth.uid()
     )
   )
   or e.gm_id = auth.uid()
   or (e.campaign_id is not null and public.is_campaign_gm(e.campaign_id));

create or replace view public.v_user_assets_with_folders
with (security_invoker = true) as
select
  ua.*,
  uaf.name as folder_name,
  uaf.slug as folder_slug,
  uaf.color as folder_color
from public.user_assets ua
left join public.user_asset_folders uaf on uaf.id = ua.folder_id
where ua.owner_id = auth.uid();

grant select on public.v_user_campaigns to authenticated;
grant select on public.v_vtt_campaign_scenes to authenticated;
grant select on public.v_visible_vtt_tokens to authenticated;
grant select on public.v_user_assets_with_folders to authenticated;

create or replace function public.get_compendium_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when public.is_admin() then jsonb_build_object(
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
    )
    else jsonb_build_object(
      'weapons', coalesce(
        (select jsonb_agg(vw order by vw.name asc) from public.v_active_weapons vw),
        '[]'::jsonb
      ),
      'skillTrees', coalesce(
        (select jsonb_agg(vt order by vt.name asc) from public.v_active_skill_trees vt),
        '[]'::jsonb
      ),
      'perkNodes', coalesce(
        (select jsonb_agg(vp order by vp.tier asc, vp.name asc) from public.v_active_perk_nodes vp),
        '[]'::jsonb
      ),
      'keywords', coalesce(
        (select jsonb_agg(vk order by vk.term asc) from public.v_active_keywords vk),
        '[]'::jsonb
      )
    )
  end;
$$;

grant execute on function public.get_compendium_bundle() to authenticated, anon;

create or replace function public.get_user_campaigns_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'yourGames', coalesce(
      (
        select jsonb_agg(vc order by vc.created_at desc)
        from public.v_user_campaigns vc
        where vc.membership_role = 'gm'
      ),
      '[]'::jsonb
    ),
    'joinedGames', coalesce(
      (
        select jsonb_agg(vc order by vc.created_at desc)
        from public.v_user_campaigns vc
        where vc.membership_role = 'player'
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.get_user_campaigns_bundle() to authenticated;

create or replace function public.join_campaign_by_invite(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_code text := upper(trim(coalesce(p_invite_code, '')));
  v_campaign public.campaigns%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if v_clean_code = '' then
    raise exception 'Invite code is required.'
      using errcode = '22023';
  end if;

  select *
  into v_campaign
  from public.campaigns c
  where upper(c.invite_code) = v_clean_code
  limit 1;

  if not found then
    raise exception 'No game found with invite code "%".', v_clean_code
      using errcode = 'P0002';
  end if;

  if v_campaign.gm_id = v_uid then
    raise exception 'You are the Game Master of this game (it is already in Your Games).'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = v_campaign.id
      and cm.user_id = v_uid
  ) then
    raise exception 'You have already joined this game.'
      using errcode = '23505';
  end if;

  insert into public.campaign_members (campaign_id, user_id)
  values (v_campaign.id, v_uid);

  return to_jsonb(v_campaign);
end;
$$;

grant execute on function public.join_campaign_by_invite(text) to authenticated;

create or replace function public.get_vtt_room_bundle(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_active_scene_id uuid;
begin
  if not public.is_campaign_participant(p_campaign_id) then
    raise exception 'Permission denied: Not a member of this campaign.'
      using errcode = '42501';
  end if;

  select *
  into v_campaign
  from public.campaigns c
  where c.id = p_campaign_id;

  if not found then
    raise exception 'Campaign not found.'
      using errcode = 'P0002';
  end if;

  select s.id
  into v_active_scene_id
  from public.v_vtt_campaign_scenes s
  where s.campaign_id = p_campaign_id
  order by s.is_active_scene desc, s.sort_order asc, s.created_at asc
  limit 1;

  return jsonb_build_object(
    'campaign', to_jsonb(v_campaign),
    'activeSceneId', v_active_scene_id,
    'scenes', coalesce(
      (
        select jsonb_agg(s order by s.sort_order asc, s.created_at asc)
        from public.v_vtt_campaign_scenes s
        where s.campaign_id = p_campaign_id
      ),
      '[]'::jsonb
    ),
    'folders', coalesce(
      (
        select jsonb_agg(f order by f.sort_order asc, f.created_at asc)
        from public.vtt_folders f
        where f.campaign_id = p_campaign_id
      ),
      '[]'::jsonb
    ),
    'rosterActors', coalesce(
      (
        select jsonb_agg(ra order by ra.sort_order asc, ra.created_at asc)
        from public.vtt_roster_actors ra
        where ra.campaign_id = p_campaign_id
      ),
      '[]'::jsonb
    ),
    'tokens', case
      when v_active_scene_id is null then '[]'::jsonb
      else coalesce(
        (
          select jsonb_agg(vt order by vt.created_at asc)
          from public.v_visible_vtt_tokens vt
          where vt.encounter_id = v_active_scene_id
        ),
        '[]'::jsonb
      )
    end,
    'logs', coalesce(
      (
        select jsonb_agg(recent_logs order by recent_logs.created_at asc)
        from (
          select l.*
          from public.vtt_logs l
          where l.campaign_id = p_campaign_id
          order by l.created_at desc
          limit 80
        ) recent_logs
      ),
      '[]'::jsonb
    ),
    'characters', coalesce(
      (
        select jsonb_agg(ch order by ch.name asc)
        from public.characters ch
        where ch.owner_id = auth.uid()
           or ch.owner_id = v_campaign.gm_id
           or public.is_campaign_gm(p_campaign_id)
           or exists (
             select 1
             from public.campaign_members cm
             where cm.campaign_id = p_campaign_id
               and cm.user_id = ch.owner_id
           )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vtt_room_bundle(uuid) to authenticated;

create or replace function public.activate_vtt_scene(
  p_campaign_id uuid,
  p_scene_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_campaign_gm(p_campaign_id) then
    raise exception 'Permission denied: Game Master privileges required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.vtt_encounters e
    where e.id = p_scene_id
      and e.campaign_id = p_campaign_id
  ) then
    raise exception 'Scene does not belong to this campaign.'
      using errcode = 'P0002';
  end if;

  update public.vtt_encounters
  set
    is_active_scene = (id = p_scene_id),
    updated_at = now()
  where campaign_id = p_campaign_id
    and is_active_scene is distinct from (id = p_scene_id);
end;
$$;

grant execute on function public.activate_vtt_scene(uuid, uuid) to authenticated;

create or replace function public.get_collections_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'folders', coalesce(
      (
        select jsonb_agg(cf order by cf.sort_order asc, cf.created_at asc)
        from public.collection_folders cf
        where cf.owner_id = auth.uid()
      ),
      '[]'::jsonb
    ),
    'actors', coalesce(
      (
        select jsonb_agg(ca order by ca.sort_order asc, ca.created_at asc)
        from public.collection_actors ca
        where ca.owner_id = auth.uid()
      ),
      '[]'::jsonb
    )
  );
$$;

grant execute on function public.get_collections_bundle() to authenticated;

create or replace function public.get_user_assets_bundle()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_maps_id uuid;
  v_chars_id uuid;
  v_prefs public.user_asset_preferences%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_asset_folders f
    where f.owner_id = v_uid
  ) then
    insert into public.user_asset_folders (owner_id, parent_folder_id, name, slug, color, sort_order)
    values (v_uid, null, 'Maps', 'maps', '#C4491A', 0)
    returning id into v_maps_id;

    insert into public.user_asset_folders (owner_id, parent_folder_id, name, slug, color, sort_order)
    values (v_uid, null, 'Characters', 'characters', '#38B29A', 1)
    returning id into v_chars_id;

    insert into public.user_asset_preferences (owner_id, maps_folder_id, characters_folder_id, updated_at)
    values (v_uid, v_maps_id, v_chars_id, now())
    on conflict (owner_id) do update
    set
      maps_folder_id = coalesce(public.user_asset_preferences.maps_folder_id, excluded.maps_folder_id),
      characters_folder_id = coalesce(public.user_asset_preferences.characters_folder_id, excluded.characters_folder_id),
      updated_at = now();
  end if;

  select *
  into v_prefs
  from public.user_asset_preferences p
  where p.owner_id = v_uid;

  return jsonb_build_object(
    'folders', coalesce(
      (
        select jsonb_agg(f order by f.sort_order asc, f.created_at asc)
        from public.user_asset_folders f
        where f.owner_id = v_uid
      ),
      '[]'::jsonb
    ),
    'assets', coalesce(
      (
        select jsonb_agg(va order by va.created_at desc)
        from public.v_user_assets_with_folders va
      ),
      '[]'::jsonb
    ),
    'preferences', case
      when v_prefs.owner_id is not null then to_jsonb(v_prefs)
      else jsonb_build_object(
        'owner_id', v_uid,
        'maps_folder_id', null,
        'characters_folder_id', null
      )
    end
  );
end;
$$;

grant execute on function public.get_user_assets_bundle() to authenticated;
