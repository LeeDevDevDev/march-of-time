alter table public.characters
  add column if not exists inventory jsonb not null default '[]'::jsonb,
  add column if not exists notes text not null default '';

alter table public.characters replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.characters;
exception
  when duplicate_object then null;
end $$;

drop policy if exists "Owners can update their own characters" on public.characters;
drop policy if exists "Owners and admins can update characters" on public.characters;
drop policy if exists "Owners, campaign GMs, and admins can update characters" on public.characters;

create policy "Owners, campaign GMs, and admins can update characters"
  on public.characters for update to authenticated
  using (
    auth.uid() = owner_id
    or public.is_admin()
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
