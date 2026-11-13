alter table public.vtt_encounters
  add column if not exists scene_width int,
  add column if not exists scene_height int,
  add column if not exists padding numeric(4,2) not null default 0.20;

alter table public.vtt_encounters
  alter column grid_size_px set default 100,
  alter column padding set default 0.20,
  alter column grid_opacity set default 0.20;
