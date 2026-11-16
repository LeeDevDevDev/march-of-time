import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ArmorModel,
  CompendiumItemModel,
  DEFAULT_COMPENDIUM_ARMORS,
  DEFAULT_COMPENDIUM_ITEMS,
  DEFAULT_KEYWORDS,
  KeywordDefinition,
  PerkNodeModel,
  SkillTreeModel,
  WeaponModel,
  normalizePerkNodesTiers,
} from './compendium.model';

export interface CompendiumBundle {
  weapons: WeaponModel[];
  armors: ArmorModel[];
  items: CompendiumItemModel[];
  skillTrees: SkillTreeModel[];
  perkNodes: PerkNodeModel[];
  keywords: KeywordDefinition[];
}

export function slugifyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isMissingCompendiumTableError(
  code?: string,
  message?: string
): boolean {
  if (code === '42P01' || code === 'PGRST205') return true;
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

@Injectable({ providedIn: 'root' })
export class CompendiumService {
  private readonly supabase = inject(SupabaseService).client;

  async fetchFullCompendium(includeInactive = false): Promise<CompendiumBundle> {
    const { data, error } = await this.supabase.rpc('get_compendium_bundle');

    if (!error && data) {
      const bundle = data as Partial<CompendiumBundle>;
      return {
        weapons: bundle.weapons ?? [],
        armors:
          bundle.armors && bundle.armors.length > 0
            ? bundle.armors
            : DEFAULT_COMPENDIUM_ARMORS,
        items:
          bundle.items && bundle.items.length > 0
            ? bundle.items
            : DEFAULT_COMPENDIUM_ITEMS,
        skillTrees: bundle.skillTrees ?? [],
        perkNodes: normalizePerkNodesTiers(bundle.perkNodes ?? []),
        keywords:
          bundle.keywords && bundle.keywords.length > 0
            ? bundle.keywords
            : DEFAULT_KEYWORDS,
      };
    }

    if (!includeInactive) {
      const [vWeps, vArmors, vItems, vTrees, vPerks, vKw] = await Promise.all([
        this.supabase.from('v_active_weapons').select('*').order('name'),
        this.supabase.from('v_active_armors').select('*').order('name'),
        this.supabase.from('v_active_items').select('*').order('name'),
        this.supabase.from('v_active_skill_trees').select('*').order('name'),
        this.supabase
          .from('v_active_perk_nodes')
          .select('*')
          .order('tier', { ascending: true })
          .order('name', { ascending: true }),
        this.supabase.from('v_active_keywords').select('*').order('term'),
      ]);

      if (!vWeps.error && !vTrees.error && !vPerks.error && !vKw.error) {
        return {
          weapons: (vWeps.data as WeaponModel[]) ?? [],
          armors:
            !vArmors.error && vArmors.data && vArmors.data.length > 0
              ? (vArmors.data as ArmorModel[])
              : DEFAULT_COMPENDIUM_ARMORS,
          items:
            !vItems.error && vItems.data && vItems.data.length > 0
              ? (vItems.data as CompendiumItemModel[])
              : DEFAULT_COMPENDIUM_ITEMS,
          skillTrees: (vTrees.data as SkillTreeModel[]) ?? [],
          perkNodes: normalizePerkNodesTiers(
            (vPerks.data as PerkNodeModel[]) ?? []
          ),
          keywords:
            vKw.data && vKw.data.length > 0
              ? (vKw.data as KeywordDefinition[])
              : DEFAULT_KEYWORDS,
        };
      }
    }

    const [wepsRes, armorsRes, itemsRes, treesRes, perksRes, kwRes] =
      await Promise.all([
        this.supabase.from('weapons').select('*').order('name'),
        this.supabase.from('compendium_armors').select('*').order('name'),
        this.supabase.from('compendium_items').select('*').order('name'),
        this.supabase.from('skill_trees').select('*').order('name'),
        this.supabase
          .from('perk_nodes')
          .select('*')
          .order('tier', { ascending: true })
          .order('name', { ascending: true }),
        this.supabase.from('compendium_keywords').select('*').order('term'),
      ]);

    return {
      weapons: (wepsRes.data as WeaponModel[]) ?? [],
      armors:
        !armorsRes.error && armorsRes.data && armorsRes.data.length > 0
          ? (armorsRes.data as ArmorModel[])
          : DEFAULT_COMPENDIUM_ARMORS,
      items:
        !itemsRes.error && itemsRes.data && itemsRes.data.length > 0
          ? (itemsRes.data as CompendiumItemModel[])
          : DEFAULT_COMPENDIUM_ITEMS,
      skillTrees: (treesRes.data as SkillTreeModel[]) ?? [],
      perkNodes: normalizePerkNodesTiers(
        (perksRes.data as PerkNodeModel[]) ?? []
      ),
      keywords:
        kwRes.data && kwRes.data.length > 0
          ? (kwRes.data as KeywordDefinition[])
          : DEFAULT_KEYWORDS,
    };
  }

  async insertKeyword(input: {
    term: string;
    category: string;
    summary: string;
  }): Promise<KeywordDefinition> {
    const { data, error } = await this.supabase
      .from('compendium_keywords')
      .upsert(
        {
          ...input,
          is_active: true,
        },
        { onConflict: 'term' }
      )
      .select('*')
      .single();

    if (!error && data) {
      return data as KeywordDefinition;
    }

    return {
      id: `kw-${slugifyText(input.term)}-${Date.now()}`,
      ...input,
      is_active: true,
    };
  }

  async updateKeywordRecord(
    idOrTerm: string,
    input: { term: string; category: string; summary: string }
  ): Promise<void> {
    if (idOrTerm && !idOrTerm.startsWith('kw-')) {
      await this.supabase
        .from('compendium_keywords')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idOrTerm);
    } else {
      await this.supabase
        .from('compendium_keywords')
        .upsert(input, { onConflict: 'term' });
    }
  }

  async updateKeywordActiveStatus(
    kw: KeywordDefinition,
    isActive: boolean
  ): Promise<void> {
    const query = this.supabase
      .from('compendium_keywords')
      .update({ is_active: isActive });

    if (kw.id && !kw.id.startsWith('kw-')) {
      await query.eq('id', kw.id);
    } else {
      await query.eq('term', kw.term);
    }
  }

  async deleteKeywordRecord(kw: KeywordDefinition): Promise<void> {
    await this.updateKeywordActiveStatus(kw, false);
  }

  async insertSkillTree(input: {
    name: string;
    slug: string;
    description: string;
    icon?: string | null;
    icon_color?: string | null;
    icon_tint_custom?: boolean | null;
  }): Promise<{ data: SkillTreeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('skill_trees')
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description,
        icon: input.icon ?? 'greatsword',
        icon_color: input.icon_color ?? '#FF8C5A',
        icon_tint_custom: input.icon_tint_custom ?? true,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to create skill tree.',
      };
    }

    return { data: data as SkillTreeModel, error: null };
  }

  async updateSkillTreeRecord(
    treeId: string,
    input: {
      name: string;
      description: string;
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
      is_active?: boolean;
    }
  ): Promise<{ data: SkillTreeModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('skill_trees')
      .update({
        name: input.name,
        description: input.description,
        icon: input.icon ?? null,
        icon_color: input.icon_color ?? null,
        icon_tint_custom: input.icon_tint_custom ?? true,
        is_active: input.is_active ?? true,
      })
      .eq('id', treeId)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to update skill tree.',
      };
    }

    return { data: data as SkillTreeModel, error: null };
  }

  async updateSkillTreeActiveStatus(
    treeId: string,
    isActive: boolean
  ): Promise<void> {
    await this.supabase
      .from('skill_trees')
      .update({ is_active: isActive })
      .eq('id', treeId);
  }

  async deleteSkillTreeRecord(
    treeId: string,
    currentSlug?: string
  ): Promise<string | null> {
    const { error: rpcError } = await this.supabase.rpc(
      'soft_delete_skill_tree',
      { p_tree_id: treeId }
    );

    if (!rpcError) {
      return null;
    }

    const archivedSlug = `${(currentSlug || 'tree').replace(/-archived-[a-z0-9]+$/i, '')}-archived-${Date.now().toString(36)}`;
    const { error } = await this.supabase
      .from('skill_trees')
      .update({ is_active: false, slug: archivedSlug })
      .eq('id', treeId);

    void this.supabase
      .from('perk_nodes')
      .update({ is_active: false })
      .eq('tree_id', treeId);

    return error?.message ?? null;
  }

  async insertPerkNode(
    payload: Record<string, unknown>,
    visuals: {
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
    }
  ): Promise<{ data: PerkNodeModel | null; error: string | null }> {
    const requestedTier =
      typeof payload['tier'] === 'number' && payload['tier'] >= 1
        ? payload['tier']
        : 1;
    const baseInsert = {
      ...payload,
      tier: requestedTier,
      icon: visuals.icon ?? null,
      icon_color: visuals.icon_color ?? null,
      icon_tint_custom: visuals.icon_tint_custom ?? true,
      is_active: true,
    };

    let { data, error } = await this.supabase
      .from('perk_nodes')
      .insert(baseInsert)
      .select('*')
      .single();

    if (
      error &&
      requestedTier > 5 &&
      (error.code === '23514' || error.message.toLowerCase().includes('tier'))
    ) {
      const retry = await this.supabase
        .from('perk_nodes')
        .insert({ ...baseInsert, tier: 5 })
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to create node.',
      };
    }

    return {
      data: { ...(data as PerkNodeModel), tier: requestedTier },
      error: null,
    };
  }

  async updatePerkNodeRecord(
    nodeId: string,
    payload: Record<string, unknown>,
    visuals: {
      icon?: string | null;
      icon_color?: string | null;
      icon_tint_custom?: boolean | null;
      is_active?: boolean;
    }
  ): Promise<{ data: PerkNodeModel | null; error: string | null }> {
    const requestedTier =
      typeof payload['tier'] === 'number' && payload['tier'] >= 1
        ? payload['tier']
        : 1;
    const baseUpdate = {
      ...payload,
      tier: requestedTier,
      icon: visuals.icon ?? null,
      icon_color: visuals.icon_color ?? null,
      icon_tint_custom: visuals.icon_tint_custom ?? true,
      is_active: visuals.is_active ?? true,
    };

    let { data, error } = await this.supabase
      .from('perk_nodes')
      .update(baseUpdate)
      .eq('id', nodeId)
      .select('*')
      .single();

    if (
      error &&
      requestedTier > 5 &&
      (error.code === '23514' || error.message.toLowerCase().includes('tier'))
    ) {
      const retry = await this.supabase
        .from('perk_nodes')
        .update({ ...baseUpdate, tier: 5 })
        .eq('id', nodeId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to update node.',
      };
    }

    return {
      data: { ...(data as PerkNodeModel), tier: requestedTier },
      error: null,
    };
  }

  async updatePerkNodePlacement(
    nodeId: string,
    patch: {
      tree_id: string | null;
      parent_node_id: string | null;
      tier: number;
      rule_hooks: PerkNodeModel['rule_hooks'];
    }
  ): Promise<{ data: PerkNodeModel | null; error: string | null }> {
    const requestedTier = Math.max(1, patch.tier);
    let { data, error } = await this.supabase
      .from('perk_nodes')
      .update({
        tree_id: patch.tree_id,
        parent_node_id: patch.parent_node_id,
        tier: requestedTier,
        rule_hooks: patch.rule_hooks,
      })
      .eq('id', nodeId)
      .select('*')
      .single();

    if (
      error &&
      requestedTier > 5 &&
      (error.code === '23514' || error.message.toLowerCase().includes('tier'))
    ) {
      const retry = await this.supabase
        .from('perk_nodes')
        .update({
          tree_id: patch.tree_id,
          parent_node_id: patch.parent_node_id,
          tier: 5,
          rule_hooks: patch.rule_hooks,
        })
        .eq('id', nodeId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to move node.',
      };
    }

    return {
      data: { ...(data as PerkNodeModel), tier: requestedTier },
      error: null,
    };
  }

  async updatePerkNodeActiveStatus(
    nodeId: string,
    nextHooks: PerkNodeModel['rule_hooks'],
    isActive: boolean
  ): Promise<void> {
    await this.supabase
      .from('perk_nodes')
      .update({ is_active: isActive, rule_hooks: nextHooks })
      .eq('id', nodeId);
  }

  async deletePerkNodeRecord(
    nodeId: string,
    currentSlug?: string,
    nextHooks?: PerkNodeModel['rule_hooks']
  ): Promise<string | null> {
    const { error: rpcError } = await this.supabase.rpc(
      'soft_delete_perk_node',
      { p_node_id: nodeId }
    );

    if (!rpcError) {
      return null;
    }

    const archivedSlug = `${(currentSlug || 'node').replace(/-archived-[a-z0-9]+$/i, '')}-archived-${Date.now().toString(36)}`;
    const { error } = await this.supabase
      .from('perk_nodes')
      .update({
        is_active: false,
        slug: archivedSlug,
        rule_hooks: { ...(nextHooks ?? {}), __is_active: false },
      })
      .eq('id', nodeId);

    return error?.message ?? null;
  }

  async uploadCompendiumIconFile(
    file: File,
    fallbackDataUrl: string
  ): Promise<{ url: string; storedInBucket: boolean }> {
    const ext = (file.name.split('.').pop() || 'png')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const baseName =
      slugifyText(file.name.replace(/\.[^.]+$/, '')) || 'icon';
    const filePath = `icons/${Date.now()}-${baseName}.${ext}`;

    const { error } = await this.supabase.storage
      .from('compendium-icons')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || undefined,
      });

    if (!error) {
      const { data } = this.supabase.storage
        .from('compendium-icons')
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        return { url: data.publicUrl, storedInBucket: true };
      }
    }

    return { url: fallbackDataUrl, storedInBucket: false };
  }

  async insertWeapon(
    payload: Record<string, unknown>
  ): Promise<{ data: WeaponModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('weapons')
      .insert({
        ...payload,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? 'Unable to forge weapon.',
      };
    }

    return {
      data: data as WeaponModel,
      error: null,
    };
  }

  async updateWeaponRecord(
    weaponId: string,
    patch: Omit<WeaponModel, 'id' | 'slug'>
  ): Promise<void> {
    await this.supabase.from('weapons').update(patch).eq('id', weaponId);
  }

  async updateWeaponActiveStatus(
    weaponId: string,
    nextHooks: Record<string, unknown>,
    isActive: boolean
  ): Promise<void> {
    await this.supabase
      .from('weapons')
      .update({ is_active: isActive, rule_hooks: nextHooks })
      .eq('id', weaponId);
  }

  async deleteWeaponRecord(
    weaponId: string,
    currentSlug?: string,
    nextHooks?: Record<string, unknown>
  ): Promise<void> {
    const { error: rpcError } = await this.supabase.rpc('soft_delete_weapon', {
      p_weapon_id: weaponId,
    });

    if (!rpcError) {
      return;
    }

    const archivedSlug = `${(currentSlug || 'weapon').replace(/-archived-[a-z0-9]+$/i, '')}-archived-${Date.now().toString(36)}`;
    await this.supabase
      .from('weapons')
      .update({
        is_active: false,
        slug: archivedSlug,
        rule_hooks: { ...(nextHooks ?? {}), __is_active: false },
      })
      .eq('id', weaponId);
  }

  async updateWeaponHooksRecord(
    weaponId: string,
    nextHooks: Record<string, unknown>
  ): Promise<void> {
    await this.supabase
      .from('weapons')
      .update({ rule_hooks: nextHooks })
      .eq('id', weaponId);
  }

  async insertArmor(
    payload: Record<string, unknown>
  ): Promise<{ data: ArmorModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('compendium_armors')
      .insert({
        ...payload,
        is_active: true,
      })
      .select('*')
      .single();

    if (!error && data) {
      return { data: data as ArmorModel, error: null };
    }

    if (error && isMissingCompendiumTableError(error.code, error.message)) {
      return {
        data: {
          id: `armor-${String(payload['slug'] || 'custom')}-${Date.now()}`,
          slug: String(payload['slug'] || 'armor'),
          name: String(payload['name'] || 'Armor'),
          weight_class:
            payload['weight_class'] === 'Medium' ||
            payload['weight_class'] === 'Heavy'
              ? payload['weight_class']
              : 'Light',
          armor_sp: Number(payload['armor_sp']) || 0,
          armor_dr: Number(payload['armor_dr']) || 0,
          allows_dodge: Boolean(payload['allows_dodge']),
          speed_penalty_tiles: Number(payload['speed_penalty_tiles']) || 0,
          description: String(payload['description'] || ''),
          rule_hooks: (payload['rule_hooks'] as Record<string, unknown>) ?? {},
          is_active: true,
        },
        error: null,
      };
    }

    return {
      data: null,
      error: error?.message ?? 'Unable to forge armor.',
    };
  }

  async updateArmorRecord(
    armorId: string,
    patch: Omit<ArmorModel, 'id' | 'slug'>
  ): Promise<void> {
    if (armorId.startsWith('armor-')) return;
    await this.supabase
      .from('compendium_armors')
      .update(patch)
      .eq('id', armorId);
  }

  async updateArmorActiveStatus(
    armorId: string,
    nextHooks: Record<string, unknown>,
    isActive: boolean
  ): Promise<void> {
    if (armorId.startsWith('armor-')) return;
    await this.supabase
      .from('compendium_armors')
      .update({ is_active: isActive, rule_hooks: nextHooks })
      .eq('id', armorId);
  }

  async deleteArmorRecord(
    armorId: string,
    currentSlug?: string,
    nextHooks?: Record<string, unknown>
  ): Promise<void> {
    if (armorId.startsWith('armor-')) return;
    const { error: rpcError } = await this.supabase.rpc('soft_delete_armor', {
      p_armor_id: armorId,
    });
    if (!rpcError) return;

    const archivedSlug = `${(currentSlug || 'armor').replace(/-archived-[a-z0-9]+$/i, '')}-archived-${Date.now().toString(36)}`;
    await this.supabase
      .from('compendium_armors')
      .update({
        is_active: false,
        slug: archivedSlug,
        rule_hooks: { ...(nextHooks ?? {}), __is_active: false },
      })
      .eq('id', armorId);
  }

  async insertCompendiumItem(
    payload: Record<string, unknown>
  ): Promise<{ data: CompendiumItemModel | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from('compendium_items')
      .insert({
        ...payload,
        is_active: true,
      })
      .select('*')
      .single();

    if (!error && data) {
      return { data: data as CompendiumItemModel, error: null };
    }

    if (error && isMissingCompendiumTableError(error.code, error.message)) {
      return {
        data: {
          id: `item-${String(payload['slug'] || 'custom')}-${Date.now()}`,
          slug: String(payload['slug'] || 'item'),
          name: String(payload['name'] || 'Item'),
          subcategory: String(payload['subcategory'] || 'Adventuring Gear'),
          default_quantity: Math.max(
            1,
            Number(payload['default_quantity']) || 1
          ),
          stackable: payload['stackable'] !== false,
          description: String(payload['description'] || ''),
          rule_hooks: (payload['rule_hooks'] as Record<string, unknown>) ?? {},
          is_active: true,
        },
        error: null,
      };
    }

    return {
      data: null,
      error: error?.message ?? 'Unable to create item.',
    };
  }

  async updateCompendiumItemRecord(
    itemId: string,
    patch: Omit<CompendiumItemModel, 'id' | 'slug'>
  ): Promise<void> {
    if (itemId.startsWith('item-')) return;
    await this.supabase
      .from('compendium_items')
      .update(patch)
      .eq('id', itemId);
  }

  async updateCompendiumItemActiveStatus(
    itemId: string,
    nextHooks: Record<string, unknown>,
    isActive: boolean
  ): Promise<void> {
    if (itemId.startsWith('item-')) return;
    await this.supabase
      .from('compendium_items')
      .update({ is_active: isActive, rule_hooks: nextHooks })
      .eq('id', itemId);
  }

  async deleteCompendiumItemRecord(
    itemId: string,
    currentSlug?: string,
    nextHooks?: Record<string, unknown>
  ): Promise<void> {
    if (itemId.startsWith('item-')) return;
    const { error: rpcError } = await this.supabase.rpc('soft_delete_item', {
      p_item_id: itemId,
    });
    if (!rpcError) return;

    const archivedSlug = `${(currentSlug || 'item').replace(/-archived-[a-z0-9]+$/i, '')}-archived-${Date.now().toString(36)}`;
    await this.supabase
      .from('compendium_items')
      .update({
        is_active: false,
        slug: archivedSlug,
        rule_hooks: { ...(nextHooks ?? {}), __is_active: false },
      })
      .eq('id', itemId);
  }
}
