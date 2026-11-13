drop policy if exists "GM can delete vtt logs" on public.vtt_logs;
drop policy if exists "GM or sender can delete vtt logs" on public.vtt_logs;

create policy "GM or sender can delete vtt logs"
  on public.vtt_logs for delete to authenticated
  using (
    public.is_admin()
    or sender_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = vtt_logs.campaign_id
        and c.gm_id = auth.uid()
    )
  );
