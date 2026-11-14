alter table public.vtt_tokens
  add column if not exists darkvision_feet int not null default 10;

alter table public.vtt_roster_actors
  add column if not exists darkvision_feet int not null default 10;

alter table public.collection_actors
  add column if not exists darkvision_feet int not null default 10;

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

grant select on public.v_visible_vtt_tokens to authenticated;
