alter table public.vtt_encounters
  drop constraint if exists vtt_encounters_grid_mode_check;

alter table public.vtt_encounters
  add constraint vtt_encounters_grid_mode_check
  check (grid_mode in ('square', 'hex', 'gridless'));

alter table public.vtt_encounters
  alter column grid_mode set default 'square';

update public.vtt_encounters
  set grid_mode = 'square'
  where grid_mode = 'hex';
