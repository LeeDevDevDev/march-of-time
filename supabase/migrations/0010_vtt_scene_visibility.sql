alter table public.vtt_encounters
  add column if not exists token_vision boolean not null default true;
