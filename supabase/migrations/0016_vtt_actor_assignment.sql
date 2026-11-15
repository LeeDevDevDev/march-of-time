create or replace view public.v_visible_vtt_tokens
with (security_invoker = true) as
select t.*
from public.vtt_tokens t
join public.vtt_encounters e on e.id = t.encounter_id
where not coalesce(t.is_hidden, false)
   or t.owner_id = auth.uid()
   or e.gm_id = auth.uid()
   or (e.campaign_id is not null and public.is_campaign_gm(e.campaign_id));

grant select on public.v_visible_vtt_tokens to authenticated;

drop policy if exists "Owners, campaign GMs, and admins can update characters" on public.characters;
drop policy if exists "Owners, assigned VTT players, campaign GMs, and admins can update characters" on public.characters;

create policy "Owners, assigned VTT players, campaign GMs, and admins can update characters"
  on public.characters for update to authenticated
  using (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1
      from public.vtt_roster_actors ra
      where ra.character_id = public.characters.id
        and ra.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_tokens vt
      where vt.character_id = public.characters.id
        and vt.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_roster_actors ra
      join public.campaigns c on c.id = ra.campaign_id
      where ra.character_id = public.characters.id
        and c.gm_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_tokens vt
      join public.vtt_encounters ve on ve.id = vt.encounter_id
      left join public.campaigns c on c.id = ve.campaign_id
      where vt.character_id = public.characters.id
        and (ve.gm_id = auth.uid() or c.gm_id = auth.uid())
    )
    or exists (
      select 1
      from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where cm.user_id = public.characters.owner_id
        and c.gm_id = auth.uid()
    )
  )
  with check (
    auth.uid() = owner_id
    or public.is_admin()
    or exists (
      select 1
      from public.vtt_roster_actors ra
      where ra.character_id = public.characters.id
        and ra.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_tokens vt
      where vt.character_id = public.characters.id
        and vt.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_roster_actors ra
      join public.campaigns c on c.id = ra.campaign_id
      where ra.character_id = public.characters.id
        and c.gm_id = auth.uid()
    )
    or exists (
      select 1
      from public.vtt_tokens vt
      join public.vtt_encounters ve on ve.id = vt.encounter_id
      left join public.campaigns c on c.id = ve.campaign_id
      where vt.character_id = public.characters.id
        and (ve.gm_id = auth.uid() or c.gm_id = auth.uid())
    )
    or exists (
      select 1
      from public.campaign_members cm
      join public.campaigns c on c.id = cm.campaign_id
      where cm.user_id = public.characters.owner_id
        and c.gm_id = auth.uid()
    )
  );
