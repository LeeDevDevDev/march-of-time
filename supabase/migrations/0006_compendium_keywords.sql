-- ============================================================================
-- MARCH OF TIME — 0006 ADMIN-EDITABLE SPECIAL KEYWORDS & GLOSSARY
-- Run this in your Supabase SQL Editor
-- ============================================================================

create table if not exists public.compendium_keywords (
  id uuid primary key default gen_random_uuid(),
  term text unique not null,
  category text not null default 'Core Mechanic',
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.compendium_keywords enable row level security;

drop policy if exists "Everyone can view compendium keywords" on public.compendium_keywords;
create policy "Everyone can view compendium keywords"
  on public.compendium_keywords for select
  using (true);

drop policy if exists "Admins can insert compendium keywords" on public.compendium_keywords;
create policy "Admins can insert compendium keywords"
  on public.compendium_keywords for insert to authenticated
  with check (true);

drop policy if exists "Admins can update compendium keywords" on public.compendium_keywords;
create policy "Admins can update compendium keywords"
  on public.compendium_keywords for update to authenticated
  using (true) with check (true);

drop policy if exists "Admins can delete compendium keywords" on public.compendium_keywords;
create policy "Admins can delete compendium keywords"
  on public.compendium_keywords for delete to authenticated
  using (true);

-- Seed Official March of Time Special Keywords
insert into public.compendium_keywords (term, category, summary)
values
  ('Crushing', 'Defense Triangle Tag', 'Overwhelming momentum that cannot be Parried. The defender must declare [Dodge] or rely on [Raise Shield] ([Shield Block]), or take the full hit.'),
  ('Piercing', 'Defense Triangle Tag', 'Needle-point thrust that bypasses shields and ignores [Raise Shield] ([Shield Block]). The defender must declare [Parry] or [Dodge].'),
  ('Sweeping', 'Defense Triangle Tag', 'Wide horizontal arc that covers adjacent escape lanes and cannot be Dodged. The defender must declare [Parry] or rely on [Raise Shield] ([Shield Block]).'),
  ('Parry', 'Active Defense', 'Costs 1 AP Reaction before the attack roll (2d10 + Technique + Parry). Beats the attack to negate all damage; a Buckler enables Martial Parry to deal Flawless Counter (2 + Parry Mod [SP] damage) on +5 or more.'),
  ('Dodge', 'Active Defense', 'Costs 1 AP Reaction before the attack roll (2d10 + Agility + Dodge) and shifts you 1 Tile. Winning by +5 or more triggers a Flawless Dodge, refunding the 1 AP spent. Disabled by Heavy Armor or a Heavy/Tower Shield.'),
  ('Raise Shield', 'Active Defense', '1 AP Action on your turn (Medium/Standard Shield, Heavy/Tower Shield, or [Heavy] Weapon Guard): Activates your [Shield Block] mitigation (Shield or Heavy Weapon Base + Block Skill, no roll required) against all non-[Piercing] attacks until your next turn.'),
  ('Shield Block', 'Active Defense', 'Active while [Raise Shield] / Guard (1 AP action) is up. Automatically mitigates incoming non-[Piercing] damage by Base + Block Skill (Standard Shield Base 3, Tower Shield Base 5, [Heavy] Weapon Base 2; no roll required, remaining damage goes to [SP]).'),
  ('Two-Handed', 'Core Mechanic', 'Requires both hands to wield. You cannot use an off-hand Shield while a Two-Handed weapon is active (any equipped shield is stowed).'),
  ('Heavy', 'Core Mechanic', 'Massive weapon heft that can be braced defensively: allows you to use [Raise Shield] / Guard (1 AP) to Block incoming non-[Piercing] attacks using your Block Skill (Heavy Weapon Base 2 + Block Skill), even while [Two-Handed] without a shield.'),
  ('Stance Recovery', 'Core Mechanic', '1 AP Action on your turn: Steady your breathing and posture to recover 2 + Iron [SP].'),
  ('Sundered', 'Combat Status', 'Armor plates and guard are compromised: target suffers -2 [Armor DR] and -2 to [Shield Block] mitigation until the end of their next turn.'),
  ('Staggered', 'Combat Status', 'Rattled posture: target starts their next round with -1 AP (3 AP instead of 4 AP) and cannot trigger Flawless reactions.'),
  ('Bleeding', 'Combat Status', 'Lacerated vital vessels: target loses 1 [HP] directly (bypassing [SP] and [Armor DR]) at the end of each turn until bandaged or stabilized.'),
  ('Pinned', 'Combat Status', 'Locked in place: target cannot spend AP to Move or declare [Dodge] reactions until they spend 1 AP to break free.'),
  ('SP', 'Core Mechanic', 'Stamina & Poise (2 + Iron + Armor SP). All attacks deplete SP first; once SP reaches 0, overflow damage strikes [HP]. Spend 1 AP on [Stance Recovery] to restore 2 + Iron SP.'),
  ('HP', 'Core Mechanic', 'Physical Health (5 + Iron×2). Protected by [Armor DR] once your [SP] is broken.'),
  ('Armor DR', 'Core Mechanic', 'Flat damage reduction from equipped armor: Light (+1/+2/+3 DR, +2/+4/+6 [SP]), Medium (+2/+4/+6 DR, +1/+2/+4 [SP]), Heavy (+3/+6/+9 DR & [SP], disables [Dodge]).')
on conflict (term) do update set
  category = excluded.category,
  summary = excluded.summary;

-- Seed Two-Handed and Heavy weapon tags in public.weapons rule_hooks
update public.weapons
set rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"two_handed": true, "heavy": true, "heavy_block_base": 2}'::jsonb
where slug in ('greatsword', 'warhammer') or lower(category) = 'heavy';

update public.weapons
set rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"two_handed": true, "heavy": false}'::jsonb
where slug in ('shortbow') or lower(category) = 'ranged';

-- Allow authenticated Admins to create, update, and delete any weapon in public.weapons
drop policy if exists "Admins can insert weapons" on public.weapons;
create policy "Admins can insert weapons"
  on public.weapons for insert to authenticated
  with check (true);

drop policy if exists "Admins can update weapons" on public.weapons;
create policy "Admins can update weapons"
  on public.weapons for update to authenticated
  using (true) with check (true);

drop policy if exists "Admins can delete weapons" on public.weapons;
create policy "Admins can delete weapons"
  on public.weapons for delete to authenticated
  using (true);
