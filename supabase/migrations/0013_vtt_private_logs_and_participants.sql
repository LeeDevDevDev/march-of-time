drop policy if exists "Campaign participants can view vtt logs" on public.vtt_logs;

create policy "Campaign participants can view vtt logs"
  on public.vtt_logs for select to authenticated
  using (
    public.is_campaign_participant(campaign_id)
    and (
      jsonb_typeof(payload->'recipient_ids') is distinct from 'array'
      or sender_id = auth.uid()
      or (payload->'recipient_ids') ? (auth.uid())::text
      or public.is_admin()
    )
  );

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
    'participants', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', part.user_id,
            'display_name', part.display_name,
            'handle', part.handle,
            'role', part.role
          )
          order by part.role_sort asc, part.display_name asc
        )
        from (
          select distinct on (u.user_id)
            u.user_id,
            coalesce(p.display_name, 'Adventurer') as display_name,
            p.handle,
            u.role,
            case when u.role = 'gm' then 0 else 1 end as role_sort
          from (
            select v_campaign.gm_id as user_id, 'gm'::text as role
            union all
            select cm.user_id, 'player'::text as role
            from public.campaign_members cm
            where cm.campaign_id = p_campaign_id
              and cm.user_id <> v_campaign.gm_id
          ) u
          left join public.profiles p on p.id = u.user_id
          order by u.user_id, case when u.role = 'gm' then 0 else 1 end asc
        ) part
      ),
      '[]'::jsonb
    ),
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
