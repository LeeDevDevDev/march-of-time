create table if not exists public.compendium_armors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  weight_class text not null default 'Light' check (weight_class in ('Light', 'Medium', 'Heavy')),
  armor_sp int not null default 2 check (armor_sp >= 0),
  armor_dr int not null default 1 check (armor_dr >= 0),
  allows_dodge boolean not null default true,
  speed_penalty_tiles int not null default 0,
  description text not null default '',
  rule_hooks jsonb not null default '{}'::jsonb,
  is_official boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_compendium_armors_is_active on public.compendium_armors (is_active);

create table if not exists public.compendium_items (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  subcategory text not null default 'Adventuring Gear',
  default_quantity int not null default 1 check (default_quantity >= 1),
  stackable boolean not null default true,
  description text not null default '',
  rule_hooks jsonb not null default '{}'::jsonb,
  is_official boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_compendium_items_is_active on public.compendium_items (is_active);

alter table public.compendium_armors enable row level security;
alter table public.compendium_items enable row level security;

drop policy if exists "Everyone can view compendium armors" on public.compendium_armors;
create policy "Everyone can view compendium armors"
  on public.compendium_armors for select using (true);

drop policy if exists "Admins can insert compendium armors" on public.compendium_armors;
create policy "Admins can insert compendium armors"
  on public.compendium_armors for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update compendium armors" on public.compendium_armors;
create policy "Admins can update compendium armors"
  on public.compendium_armors for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete compendium armors" on public.compendium_armors;
create policy "Admins can delete compendium armors"
  on public.compendium_armors for delete to authenticated
  using (public.is_admin());

drop policy if exists "Everyone can view compendium items" on public.compendium_items;
create policy "Everyone can view compendium items"
  on public.compendium_items for select using (true);

drop policy if exists "Admins can insert compendium items" on public.compendium_items;
create policy "Admins can insert compendium items"
  on public.compendium_items for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update compendium items" on public.compendium_items;
create policy "Admins can update compendium items"
  on public.compendium_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete compendium items" on public.compendium_items;
create policy "Admins can delete compendium items"
  on public.compendium_items for delete to authenticated
  using (public.is_admin());

create or replace view public.v_active_armors
with (security_invoker = true) as
select *
from public.compendium_armors
where is_active = true
  and coalesce((rule_hooks->>'__is_active')::boolean, true) = true;

create or replace view public.v_active_items
with (security_invoker = true) as
select *
from public.compendium_items
where is_active = true
  and coalesce((rule_hooks->>'__is_active')::boolean, true) = true;

grant select on public.v_active_armors to authenticated, anon;
grant select on public.v_active_items to authenticated, anon;

create or replace function public.soft_delete_armor(p_armor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Permission denied';
  end if;
  update public.compendium_armors
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[a-z0-9]+$', '', 'i') || '-archived-' || substr(md5(random()::text), 1, 6),
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_armor_id;
end;
$$;

create or replace function public.soft_delete_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Permission denied';
  end if;
  update public.compendium_items
  set
    is_active = false,
    slug = regexp_replace(slug, '-archived-[a-z0-9]+$', '', 'i') || '-archived-' || substr(md5(random()::text), 1, 6),
    rule_hooks = coalesce(rule_hooks, '{}'::jsonb) || '{"__is_active": false}'::jsonb
  where id = p_item_id;
end;
$$;

grant execute on function public.soft_delete_armor(uuid) to authenticated;
grant execute on function public.soft_delete_item(uuid) to authenticated;

create or replace function public.get_compendium_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when public.is_admin() then jsonb_build_object(
      'weapons', coalesce(
        (select jsonb_agg(w order by w.name asc) from public.weapons w),
        '[]'::jsonb
      ),
      'armors', coalesce(
        (select jsonb_agg(a order by a.name asc) from public.compendium_armors a),
        '[]'::jsonb
      ),
      'items', coalesce(
        (select jsonb_agg(i order by i.name asc) from public.compendium_items i),
        '[]'::jsonb
      ),
      'skillTrees', coalesce(
        (select jsonb_agg(t order by t.name asc) from public.skill_trees t),
        '[]'::jsonb
      ),
      'perkNodes', coalesce(
        (select jsonb_agg(p order by p.tier asc, p.name asc) from public.perk_nodes p),
        '[]'::jsonb
      ),
      'keywords', coalesce(
        (select jsonb_agg(k order by k.term asc) from public.compendium_keywords k),
        '[]'::jsonb
      )
    )
    else jsonb_build_object(
      'weapons', coalesce(
        (select jsonb_agg(vw order by vw.name asc) from public.v_active_weapons vw),
        '[]'::jsonb
      ),
      'armors', coalesce(
        (select jsonb_agg(va order by va.name asc) from public.v_active_armors va),
        '[]'::jsonb
      ),
      'items', coalesce(
        (select jsonb_agg(vi order by vi.name asc) from public.v_active_items vi),
        '[]'::jsonb
      ),
      'skillTrees', coalesce(
        (select jsonb_agg(vt order by vt.name asc) from public.v_active_skill_trees vt),
        '[]'::jsonb
      ),
      'perkNodes', coalesce(
        (select jsonb_agg(vp order by vp.tier asc, vp.name asc) from public.v_active_perk_nodes vp),
        '[]'::jsonb
      ),
      'keywords', coalesce(
        (select jsonb_agg(vk order by vk.term asc) from public.v_active_keywords vk),
        '[]'::jsonb
      )
    )
  end;
$$;

grant execute on function public.get_compendium_bundle() to authenticated, anon;

insert into public.compendium_armors (slug, name, weight_class, armor_sp, armor_dr, allows_dodge, speed_penalty_tiles, description, rule_hooks, is_official, is_active)
values
  (
    'padded-gambeson',
    'Padded Gambeson',
    'Light',
    2,
    1,
    true,
    0,
    'Quilted linen and boiled leather harness that cushions glancing blows while keeping full [Dodge] footwork.',
    '{"__icon": "breastplate", "__icon_color": "#38B29A"}'::jsonb,
    true,
    true
  ),
  (
    'studded-brigandine',
    'Studded Brigandine',
    'Light',
    4,
    2,
    true,
    0,
    'Riveted steel lames beneath supple suede. Grants bolstered [SP] poise and [Armor DR] without restricting [Dodge].',
    '{"__icon": "breastplate", "__icon_color": "#38BDF8"}'::jsonb,
    true,
    true
  ),
  (
    'scale-hauberk',
    'Scale Hauberk',
    'Medium',
    2,
    2,
    true,
    0,
    'Overlapping bronze and iron scales engineered to turn blade edges while preserving [Dodge] mobility.',
    '{"__icon": "breastplate", "__icon_color": "#F59E0B"}'::jsonb,
    true,
    true
  ),
  (
    'rivet-coat-of-plates',
    'Rivet Coat of Plates',
    'Medium',
    2,
    4,
    true,
    0,
    'Reinforced cuirass plates over chain gussets for heavy [Armor DR] mitigation that still permits [Dodge].',
    '{"__icon": "iron-helm", "__icon_color": "#FF8C5A"}'::jsonb,
    true,
    true
  ),
  (
    'vanguard-half-plate',
    'Vanguard Half-Plate',
    'Heavy',
    3,
    3,
    false,
    0,
    'Articulated breastplate, pauldrons, and greaves built for frontline clashes. Trades off [Dodge] for stout [SP] and [Armor DR].',
    '{"__icon": "iron-helm", "__icon_color": "#F26464"}'::jsonb,
    true,
    true
  ),
  (
    'fortress-full-plate',
    'Fortress Full Plate',
    'Heavy',
    6,
    6,
    false,
    0,
    'Masterwork interlocking steel harness. Massive [SP] and [Armor DR] protection; disables [Dodge].',
    '{"__icon": "iron-helm", "__icon_color": "#A78BFA"}'::jsonb,
    true,
    true
  )
on conflict (slug) do nothing;

insert into public.compendium_items (slug, name, subcategory, default_quantity, stackable, description, rule_hooks, is_official, is_active)
values
  (
    'bodkin-arrows',
    'Bodkin Arrows',
    'Ammunition',
    20,
    true,
    'Quiver of hardened iron-point shafts fletched for bows and ranged volleys.',
    '{"__icon": "quiver", "__icon_color": "#FF8C5A"}'::jsonb,
    true,
    true
  ),
  (
    'stone-and-flint',
    'Stone & Flint',
    'Camping & Survival',
    1,
    true,
    'High-carbon striker stone and sharp flint shard for sparking campfires, lanterns, and pitch torches.',
    '{"__icon": "sunfire", "__icon_color": "#F59E0B"}'::jsonb,
    true,
    true
  ),
  (
    'canvas-field-tent',
    'Canvas Field Tent',
    'Camping & Survival',
    1,
    true,
    'Waxed two-person canvas shelter with stakes and guy-lines for camp rest in harsh weather.',
    '{"__icon": "camp-tent", "__icon_color": "#38B29A"}'::jsonb,
    true,
    true
  ),
  (
    'trail-rations',
    'Trail Rations',
    'Camping & Survival',
    3,
    true,
    'Wrapped smoked meat, hardtack, and dried fruit sustaining one march day per ration.',
    '{"__icon": "pack", "__icon_color": "#F59E0B"}'::jsonb,
    true,
    true
  ),
  (
    'pitch-torch',
    'Pitch Torch',
    'Camping & Survival',
    2,
    true,
    'Resin-soaked timber brand that burns steadily to illuminate caverns and night camps.',
    '{"__icon": "sunfire", "__icon_color": "#FF8C5A"}'::jsonb,
    true,
    true
  ),
  (
    'hempen-rope-50ft',
    'Hempen Rope (50 ft)',
    'Adventuring Gear',
    1,
    true,
    'Coiled 50-foot braided rope for scaling cliffs, rigging pulleys, or securing prisoners.',
    '{"__icon": "pack", "__icon_color": "#EBF5F3"}'::jsonb,
    true,
    true
  ),
  (
    'field-bandages',
    'Field Bandages',
    'Consumable',
    2,
    true,
    'Clean linen rolls and herbal poultice used to staunch [Bleeding] and dress wounds.',
    '{"__icon": "crimson-drop", "__icon_color": "#F26464"}'::jsonb,
    true,
    true
  ),
  (
    'thieves-picks-and-tools',
    'Thieves'' Picks & Tools',
    'Tool & Kit',
    1,
    true,
    'Roll of tension wrenches, fine hooks, and files for Tinkering checks on locks and traps.',
    '{"__icon": "tactical-eye", "__icon_color": "#38BDF8"}'::jsonb,
    true,
    true
  )
on conflict (slug) do nothing;
