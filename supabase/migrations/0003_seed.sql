insert into public.weapons (
  slug,
  name,
  category,
  ap_cost,
  requires_aim,
  gov_attribute,
  gov_skill,
  base_damage,
  reach_tiles,
  thrown_range_tiles,
  trait_name,
  trait_description,
  rule_hooks,
  is_official,
  is_active
)
values
  (
    'greatsword',
    'Greatsword',
    'Heavy',
    2,
    false,
    'Brawn',
    'Strike',
    8,
    1,
    null,
    'Cleaving',
    'Costs 2 AP; still deals 3 SP damage even if Parried.',
    '{"on_parried_sp_damage": 3, "two_handed": true, "heavy": true, "heavy_block_base": 2}'::jsonb,
    true,
    true
  ),
  (
    'warhammer',
    'Warhammer',
    'Heavy',
    2,
    false,
    'Brawn',
    'Strike',
    7,
    1,
    null,
    'Armor Breaker',
    'Costs 2 AP; ignores 2 Armor.',
    '{"ignore_armor_dr": 2, "two_handed": true, "heavy": true, "heavy_block_base": 2}'::jsonb,
    true,
    true
  ),
  (
    'dagger',
    'Dagger',
    'Light',
    1,
    false,
    'Agility',
    'Strike',
    2,
    1,
    4,
    'Quick-Draw',
    'Can be thrown (4 tiles) without Aim; deals double damage vs targets at 0 SP.',
    '{"zero_sp_damage_multiplier": 2, "free_throw_range": 4}'::jsonb,
    true,
    true
  ),
  (
    'rapier',
    'Rapier',
    'Martial',
    1,
    false,
    'Agility',
    'Strike',
    3,
    1,
    null,
    'Defensive Balance',
    'Grants +1 bonus to Parry rolls while wielded.',
    '{"parry_roll_bonus": 1}'::jsonb,
    true,
    true
  ),
  (
    'longsword',
    'Longsword',
    'Martial',
    1,
    false,
    'Technique',
    'Strike',
    5,
    1,
    null,
    'Versatile',
    'Inflicts +2 bonus SP damage to the attacker on a Flawless Parry.',
    '{"flawless_parry_bonus_sp_damage": 2}'::jsonb,
    true,
    true
  ),
  (
    'spear',
    'Spear',
    'Martial',
    1,
    false,
    'Technique',
    'Strike',
    4,
    2,
    null,
    'Reach 2 Tiles',
    'Attack from 2 tiles away; prevents enemy flanking unless adjacent.',
    '{"reach_tiles": 2, "prevent_flank_unless_adjacent": true}'::jsonb,
    true,
    true
  ),
  (
    'shortbow',
    'Shortbow',
    'Ranged',
    1,
    true,
    'Technique',
    'Shoot',
    4,
    8,
    null,
    'Unwieldy (Aim)',
    'Requires 1 AP Aim before shooting, or Snap-Shoot at 1 Disadvantage.',
    '{"requires_aim_ap": 1, "snap_shoot_disadvantage": 1, "two_handed": true, "heavy": false}'::jsonb,
    true,
    true
  )
on conflict (slug) do update set
  rule_hooks = excluded.rule_hooks;

insert into public.skill_trees (slug, name, description, is_active)
values
  (
    'juggernaut',
    'Path of the Breaker',
    'Heavy posture-shattering techniques and [Crushing] blows that overwhelm blade parries.',
    true
  ),
  (
    'phantom',
    'Path of the Veil',
    'High-mobility footwork, [Piercing] thrusts that bypass shields, and precision counters.',
    true
  ),
  (
    'tempest',
    'Path of the Gale',
    'Wide-arc [Sweeping] area control and multi-target zone denial.',
    true
  )
on conflict (slug) do nothing;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'helm-splitter',
  'Helm Splitter',
  'combat_art',
  1,
  1,
  2,
  3,
  'Crushing',
  'Overhead Crushing blow that cannot be Parried (target must Dodge or Shield Block) and deals +2 bonus SP damage.',
  '{"disallow_defense": ["Parry"], "bonus_sp_damage": 2}'::jsonb
from public.skill_trees where slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'ironblood-conditioning',
  'Ironblood Conditioning',
  'passive_upgrade',
  1,
  1,
  null,
  null,
  'None',
  'Hardened posture and dense muscle fibers permanently grant +2 Max HP and +2 Max SP.',
  '{"bonus_max_hp": 2, "bonus_max_sp": 2}'::jsonb
from public.skill_trees where slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id
)
select
  t.id,
  'sundering-ram',
  'Sundering Ram',
  'combat_art',
  2,
  1,
  2,
  3,
  'Crushing',
  'Drive through the enemy''s guard: a Crushing charge that cannot be Parried, pushes the target 1 Tile, and inflicts Sundered.',
  '{"disallow_defense": ["Parry"], "push_tiles": 1, "inflict_status": "Sundered"}'::jsonb,
  (select id from public.perk_nodes where slug = 'helm-splitter' limit 1)
from public.skill_trees t where t.slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id
)
select
  t.id,
  'colossus-grip',
  'Colossus Grip',
  'passive_upgrade',
  2,
  1,
  null,
  null,
  'None',
  'Unrelenting leverage grants +1 Flat Weapon Damage and +1 Shield Block reinforcement.',
  '{"bonus_flat_damage": 1, "bonus_block_mod": 1}'::jsonb,
  (select id from public.perk_nodes where slug = 'ironblood-conditioning' limit 1)
from public.skill_trees t where t.slug = 'juggernaut'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'phantom-step',
  'Phantom Step',
  'combat_art',
  1,
  1,
  1,
  2,
  'Piercing',
  'Shift 1 Tile and deliver a Piercing lunge that cannot be Shield Blocked (target must Parry or Dodge).',
  '{"disallow_defense": ["Block"], "self_shift_tiles": 1}'::jsonb
from public.skill_trees where slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'quicksilver-reflexes',
  'Quicksilver Reflexes',
  'passive_upgrade',
  1,
  1,
  null,
  null,
  'None',
  'Razor-sharp footwork grants +1 to Dodge rolls and +2 Max SP.',
  '{"bonus_dodge_mod": 1, "bonus_max_sp": 2}'::jsonb
from public.skill_trees where slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id
)
select
  t.id,
  'heartseeker-thrust',
  'Heartseeker Thrust',
  'combat_art',
  2,
  1,
  2,
  3,
  'Piercing',
  'Precision Piercing needle strike that cannot be Shield Blocked, pierces 2 Armor DR, and inflicts Bleeding.',
  '{"disallow_defense": ["Block"], "ignore_armor_dr": 2, "inflict_status": "Bleeding"}'::jsonb,
  (select id from public.perk_nodes where slug = 'phantom-step' limit 1)
from public.skill_trees t where t.slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id
)
select
  t.id,
  'duelist-riposte',
  'Duelist''s Riposte',
  'passive_upgrade',
  2,
  1,
  null,
  null,
  'None',
  'Refined blade geometry grants +1 to Parry rolls and +1 to Attack Rolls.',
  '{"bonus_parry_mod": 1, "bonus_attack_mod": 1}'::jsonb,
  (select id from public.perk_nodes where slug = 'quicksilver-reflexes' limit 1)
from public.skill_trees t where t.slug = 'phantom'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'crescent-sweep',
  'Crescent Sweep',
  'combat_art',
  1,
  1,
  2,
  3,
  'Sweeping',
  'Wide horizontal Sweeping arc that cannot be Dodged (target must Parry or Shield Block) and deals +2 SP damage.',
  '{"disallow_defense": ["Dodge"], "bonus_sp_damage": 2}'::jsonb
from public.skill_trees where slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks
)
select
  id,
  'windrunner-stride',
  'Windrunner Stride',
  'passive_upgrade',
  1,
  1,
  null,
  null,
  'None',
  'Effortless momentum increases your movement by +1 Tile (+5 ft) per 1 AP spent moving.',
  '{"bonus_move_tiles": 1}'::jsonb
from public.skill_trees where slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id
)
select
  t.id,
  'cyclone-reap',
  'Cyclone Reap',
  'combat_art',
  2,
  1,
  2,
  3,
  'Sweeping',
  'Spinning Sweeping scythe-cut that cannot be Dodged, pushes adjacent foes 1 Tile, and inflicts Staggered.',
  '{"disallow_defense": ["Dodge"], "push_tiles": 1, "inflict_status": "Staggered"}'::jsonb,
  (select id from public.perk_nodes where slug = 'crescent-sweep' limit 1)
from public.skill_trees t where t.slug = 'tempest'
on conflict (slug) do update set
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  parent_node_id = excluded.parent_node_id;

insert into public.perk_nodes (
  tree_id,
  slug,
  name,
  node_type,
  tier,
  perk_cost,
  ap_cost,
  cooldown_rounds,
  combat_tag,
  description,
  rule_hooks,
  parent_node_id,
  icon,
  icon_color,
  icon_tint_custom,
  is_official,
  is_active
)
values
  (
    null,
    'shield-bash',
    'Shield Bash',
    'combat_art',
    1,
    1,
    1,
    2,
    'Crushing',
    'Drive your shield or weapon guard into an adjacent foe, dealing +2 [SP] damage and inflicting [Staggered] on hit. Cannot be [Parried].',
    '{"disallow_defense": ["Parry"], "bonus_sp_damage": 2, "inflict_status": "Staggered", "__is_standalone": true, "__icon": "bastion-shield", "__icon_color": "#FF8C5A", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'bastion-shield',
    '#FF8C5A',
    true,
    true,
    true
  ),
  (
    null,
    'vanguard-cleave',
    'Vanguard Cleave',
    'combat_art',
    1,
    1,
    2,
    3,
    'Sweeping',
    'Swing in a wide horizontal arc that punishes [Dodge] attempts and deals +2 flat damage.',
    '{"disallow_defense": ["Dodge"], "bonus_flat_damage": 2, "__is_standalone": true, "__icon": "battleaxe", "__icon_color": "#F26464", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'battleaxe',
    '#F26464',
    true,
    true,
    true
  ),
  (
    null,
    'veterans-resolve',
    'Veteran''s Resolve',
    'passive_upgrade',
    1,
    1,
    null,
    null,
    'None',
    'Hardened battlefield conditioning grants +2 Max [SP] and +1 [Stance Recovery] when catching your breath.',
    '{"bonus_max_sp": 2, "bonus_stance_recovery": 1, "__is_standalone": true, "__icon": "iron-helm", "__icon_color": "#38B29A", "__icon_tint_custom": true, "__is_active": true}'::jsonb,
    null,
    'iron-helm',
    '#38B29A',
    true,
    true,
    true
  )
on conflict (slug) do update set
  tree_id = excluded.tree_id,
  name = excluded.name,
  node_type = excluded.node_type,
  ap_cost = excluded.ap_cost,
  cooldown_rounds = excluded.cooldown_rounds,
  combat_tag = excluded.combat_tag,
  description = excluded.description,
  rule_hooks = excluded.rule_hooks,
  icon = excluded.icon,
  icon_color = excluded.icon_color,
  icon_tint_custom = excluded.icon_tint_custom,
  is_active = excluded.is_active;

insert into public.compendium_keywords (term, category, summary, is_active)
values
  ('Crushing', 'Defense Triangle Tag', 'Overwhelming momentum that cannot be Parried. The defender must declare [Dodge] or rely on [Raise Shield] ([Shield Block]), or take the full hit.', true),
  ('Piercing', 'Defense Triangle Tag', 'Needle-point thrust that bypasses shields and ignores [Raise Shield] ([Shield Block]). The defender must declare [Parry] or [Dodge].', true),
  ('Sweeping', 'Defense Triangle Tag', 'Wide horizontal arc that covers adjacent escape lanes and cannot be Dodged. The defender must declare [Parry] or rely on [Raise Shield] ([Shield Block]).', true),
  ('Parry', 'Active Defense', 'Costs 1 AP Reaction before the attack roll (2d10 + Technique + Parry). Beats the attack to negate all damage; a Buckler enables Martial Parry to deal Flawless Counter (2 + Parry Mod [SP] damage) on +5 or more.', true),
  ('Dodge', 'Active Defense', 'Costs 1 AP Reaction before the attack roll (2d10 + Agility + Dodge) and shifts you 1 Tile. Winning by +5 or more triggers a Flawless Dodge, refunding the 1 AP spent. Disabled by Heavy Armor or a Heavy/Tower Shield.', true),
  ('Raise Shield', 'Active Defense', '1 AP Action on your turn (Medium/Standard Shield, Heavy/Tower Shield, or [Guard] Weapon): Activates your [Shield Block] mitigation (Shield or Weapon [Guard] Base + Block Skill, no roll required) against all non-[Piercing] attacks until your next turn.', true),
  ('Shield Block', 'Active Defense', 'Active while [Raise Shield] / [Guard] (1 AP action) is up. Automatically mitigates incoming non-[Piercing] damage by Base + Block Skill (Standard Shield Base 3, Tower Shield Base 5, Weapon [Guard] Base 2; no roll required, remaining damage goes to [SP]).', true),
  ('Two-Handed', 'Core Mechanic', 'Requires both hands to wield. You cannot use an off-hand Shield while a Two-Handed weapon is active (any equipped shield is stowed).', true),
  ('Guard', 'Core Mechanic', 'Defensive weapon property: allows you to spend 1 AP on your turn to brace your weapon and Block incoming non-[Piercing] attacks using your Block Skill (Weapon Guard Base + Block Skill), even while [Two-Handed] without a shield.', true),
  ('Aim', 'Core Mechanic', 'Ranged weapons can fire anytime at Disadvantage. Spending 1 AP to Aim at your target first allows you to make a normal Shoot roll.', true),
  ('Stance Recovery', 'Core Mechanic', '1 AP Action on your turn: Steady your breathing and posture to recover 2 + Iron [SP].', true),
  ('Sundered', 'Combat Status', 'Armor plates and guard are compromised: target suffers -2 [Armor DR] and -2 to [Shield Block] mitigation until the end of their next turn.', true),
  ('Staggered', 'Combat Status', 'Rattled posture: target starts their next round with -1 AP (3 AP instead of 4 AP) and cannot trigger Flawless reactions.', true),
  ('Bleeding', 'Combat Status', 'Lacerated vital vessels: target loses 1 [HP] directly (bypassing [SP] and [Armor DR]) at the end of each turn until bandaged or stabilized.', true),
  ('Pinned', 'Combat Status', 'Locked in place: target cannot spend AP to Move or declare [Dodge] reactions until they spend 1 AP to break free.', true),
  ('SP', 'Core Mechanic', 'Stamina & Poise (2 + Iron + Armor SP). All attacks deplete SP first; once SP reaches 0, overflow damage strikes [HP]. Spend 1 AP on [Stance Recovery] to restore 2 + Iron SP.', true),
  ('HP', 'Core Mechanic', 'Physical Health (5 + Iron×2). Protected by [Armor DR] once your [SP] is broken.', true),
  ('Armor DR', 'Core Mechanic', 'Flat damage reduction from equipped armor: Light (+1/+2/+3 DR, +2/+4/+6 [SP]), Medium (+2/+4/+6 DR, +1/+2/+4 [SP]), Heavy (+3/+6/+9 DR & [SP], disables [Dodge]).', true)
on conflict (term) do update set
  category = excluded.category,
  summary = excluded.summary;
