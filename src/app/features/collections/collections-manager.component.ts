import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ActiveCombatTag,
  COMPENDIUM_ICON_PRESETS,
} from '../../core/compendium/compendium.model';
import { ColorPickerComponent } from '../../shared/color-picker/color-picker.component';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import { CharacterModel } from '../characters/models/character.model';
import {
  DirectoryFolderNode,
  DirectoryFolderOption,
  FOLDER_COLOR_SWATCHES,
  buildDirectoryTree,
  canNestFolderInside,
  collectDescendantFolderIds,
} from '../vtt/engine/directory-tree.engine';
import {
  CollectionActorModel,
  DEFAULT_VTT_DARKVISION_FEET,
  DEFAULT_VTT_DIM_VISION_FEET,
  VTT_ACTOR_COLOR_SWATCHES,
  VTT_NPC_PRESETS,
  VttActorKind,
  VttFaction,
  VttNpcPreset,
  resolveActorDarkvisionFeet,
} from '../vtt/models/vtt.model';
import {
  ActorTemplateDraft,
  CollectionsStore,
} from './collections.store';

export interface CollectionFolderModalState {
  mode: 'create' | 'edit';
  folderId: string | null;
  name: string;
  color: string;
  parentFolderId: string;
}

export interface CollectionActorFormState {
  mode: 'create' | 'edit';
  actorId: string | null;
  folderId: string;
  sourceCharacterId: string | null;
  actorKind: VttActorKind;
  isUnique: boolean;
  name: string;
  faction: VttFaction;
  size: number;
  icon: string;
  color: string;
  maxHp: number;
  maxSp: number;
  maxAp: number;
  armorDr: number;
  shieldBlock: number;
  moveFeet: number;
  visionFeet: number;
  darkvisionFeet: number;
  lightBrightFeet: number;
  lightDimFeet: number;
  lightColor: string;
  weaponName: string;
  attackAp: number;
  attackMod: number;
  flatDamage: number;
  reachFeet: number;
  combatTag: ActiveCombatTag | 'None';
  parryMod: number;
  dodgeMod: number;
  canDodge: boolean;
  notes: string;
}

@Component({
  selector: 'app-collections-manager',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgTemplateOutlet,
    ColorPickerComponent,
    CompendiumIconComponent,
  ],
  templateUrl: './collections-manager.component.html',
})
export class CollectionsManagerComponent implements OnInit {
  readonly embedded = input<boolean>(false);

  readonly collectionsStore = inject(CollectionsStore);

  readonly folderSwatches = FOLDER_COLOR_SWATCHES;
  readonly actorColorSwatches = VTT_ACTOR_COLOR_SWATCHES;
  readonly iconPresets = COMPENDIUM_ICON_PRESETS;
  readonly npcPresets = VTT_NPC_PRESETS;
  readonly combatTagChoices: (ActiveCombatTag | 'None')[] = [
    'None',
    'Crushing',
    'Sweeping',
    'Piercing',
  ];

  readonly searchQuery = signal<string>('');
  readonly kindFilter = signal<'all' | VttActorKind>('all');
  readonly selectedFolderFilter = signal<string>('all');
  readonly collapsedFolderIds = signal<Record<string, boolean>>({});
  readonly draggingActorId = signal<string | null>(null);
  readonly dragOverTarget = signal<string | null>(null);

  readonly folderModal = signal<CollectionFolderModalState | null>(null);
  readonly actorModal = signal<CollectionActorFormState | null>(null);
  readonly importModalOpen = signal<boolean>(false);
  readonly importTab = signal<'characters' | 'presets'>('characters');
  readonly importTargetFolderId = signal<string>('');
  readonly importSearch = signal<string>('');

  readonly filteredActorsForTree = computed<CollectionActorModel[]>(() => {
    const kind = this.kindFilter();
    return this.collectionsStore.actors().filter((actor) => {
      if (kind !== 'all' && actor.actor_kind !== kind) return false;
      return true;
    });
  });

  readonly directoryTree = computed(() =>
    buildDirectoryTree(
      this.collectionsStore.foldersAsDirectoryFolders(),
      this.filteredActorsForTree(),
      {
        scope: 'characters',
        getItemFolderId: (a) => a.folder_id,
        getItemName: (a) => a.name,
        getItemSortOrder: (a) => a.sort_order,
        searchQuery: this.searchQuery(),
      }
    )
  );

  readonly folderOptions = computed<DirectoryFolderOption[]>(
    () => this.directoryTree().flatFolderOptions
  );

  readonly folderNameById = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const f of this.collectionsStore.folders()) {
      map.set(f.id, f.name);
    }
    return map;
  });

  readonly visibleActors = computed<CollectionActorModel[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const kind = this.kindFilter();
    const folderFilter = this.selectedFolderFilter();

    let allowedFolderIds: Set<string> | null = null;
    if (folderFilter !== 'all' && folderFilter !== 'root') {
      const desc = collectDescendantFolderIds(
        folderFilter,
        this.collectionsStore.foldersAsDirectoryFolders()
      );
      allowedFolderIds = new Set<string>([folderFilter, ...desc]);
    }

    return this.collectionsStore
      .actors()
      .filter((actor) => {
        if (kind !== 'all' && actor.actor_kind !== kind) return false;
        if (folderFilter === 'root' && actor.folder_id !== null) return false;
        if (
          allowedFolderIds &&
          (!actor.folder_id || !allowedFolderIds.has(actor.folder_id))
        ) {
          return false;
        }
        if (
          q &&
          !actor.name.toLowerCase().includes(q) &&
          !(actor.npc_stats.weapon_name ?? '').toLowerCase().includes(q) &&
          !actor.notes.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });
  });

  readonly filteredImportCharacters = computed<CharacterModel[]>(() => {
    const q = this.importSearch().trim().toLowerCase();
    return this.collectionsStore.myCharacters().filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.equipped_armor.toLowerCase().includes(q)
      );
    });
  });

  readonly filteredImportPresets = computed<VttNpcPreset[]>(() => {
    const q = this.importSearch().trim().toLowerCase();
    return this.npcPresets.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.npc_stats.weapon_name ?? '').toLowerCase().includes(q)
      );
    });
  });

  ngOnInit(): void {
    void this.collectionsStore.loadCollections();
  }

  isFolderCollapsed(folderId: string): boolean {
    if (this.searchQuery().trim().length > 0) return false;
    return Boolean(this.collapsedFolderIds()[folderId]);
  }

  toggleFolderCollapse(folderId: string, event?: Event): void {
    event?.stopPropagation();
    this.collapsedFolderIds.update((curr) => ({
      ...curr,
      [folderId]: !curr[folderId],
    }));
  }

  selectFolderFilter(filterId: string): void {
    this.selectedFolderFilter.set(filterId);
  }

  getValidParentFolderOptions(
    editingFolderId: string | null
  ): DirectoryFolderOption[] {
    const allFolders = this.collectionsStore.foldersAsDirectoryFolders();
    return this.folderOptions().filter((opt) =>
      canNestFolderInside(editingFolderId, opt.id, allFolders, 'characters')
    );
  }

  openCreateFolderModal(parentFolderId: string | null = null): void {
    this.folderModal.set({
      mode: 'create',
      folderId: null,
      name: '',
      color: FOLDER_COLOR_SWATCHES[0],
      parentFolderId: parentFolderId ?? '',
    });
  }

  openEditFolderModal(
    node: DirectoryFolderNode<CollectionActorModel>,
    event?: Event
  ): void {
    event?.stopPropagation();
    this.folderModal.set({
      mode: 'edit',
      folderId: node.folder.id,
      name: node.folder.name,
      color: node.folder.color ?? FOLDER_COLOR_SWATCHES[0],
      parentFolderId: node.folder.parent_folder_id ?? '',
    });
  }

  closeFolderModal(): void {
    this.folderModal.set(null);
  }

  async saveFolderModal(): Promise<void> {
    const form = this.folderModal();
    if (!form) return;

    if (form.mode === 'create') {
      const created = await this.collectionsStore.createFolder(
        form.name,
        form.color,
        form.parentFolderId || null
      );
      if (created) {
        this.folderModal.set(null);
      }
      return;
    }

    if (form.folderId) {
      const ok = await this.collectionsStore.updateFolder(form.folderId, {
        name: form.name,
        color: form.color,
        parent_folder_id: form.parentFolderId || null,
      });
      if (ok) {
        this.folderModal.set(null);
      }
    }
  }

  async removeFolder(folderId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.selectedFolderFilter() === folderId) {
      this.selectedFolderFilter.set('all');
    }
    await this.collectionsStore.deleteFolder(folderId);
  }

  openCreateActorModal(kind: VttActorKind = 'character'): void {
    const activeFilter = this.selectedFolderFilter();
    const defaultFolder =
      activeFilter !== 'all' && activeFilter !== 'root' ? activeFilter : '';

    this.actorModal.set({
      mode: 'create',
      actorId: null,
      folderId: defaultFolder,
      sourceCharacterId: null,
      actorKind: kind,
      isUnique: kind === 'character',
      name: '',
      faction: kind === 'npc' ? 'enemy' : 'ally',
      size: 1,
      icon: kind === 'npc' ? 'battleaxe' : 'greatsword',
      color: kind === 'npc' ? '#EF4444' : '#38B29A',
      maxHp: 10,
      maxSp: 5,
      maxAp: 4,
      armorDr: 1,
      shieldBlock: 0,
      moveFeet: 20,
      visionFeet: DEFAULT_VTT_DIM_VISION_FEET,
      darkvisionFeet: DEFAULT_VTT_DARKVISION_FEET,
      lightBrightFeet: 0,
      lightDimFeet: 0,
      lightColor: '#F59E0B',
      weaponName: kind === 'npc' ? 'Iron Blade' : 'Longsword',
      attackAp: 1,
      attackMod: 3,
      flatDamage: 4,
      reachFeet: 5,
      combatTag: 'None',
      parryMod: 2,
      dodgeMod: 2,
      canDodge: true,
      notes: '',
    });
  }

  setActorModalKind(kind: VttActorKind): void {
    const form = this.actorModal();
    if (!form) return;
    this.actorModal.set({
      ...form,
      actorKind: kind,
      isUnique: kind === 'character',
      faction:
        form.mode === 'create'
          ? kind === 'npc'
            ? 'enemy'
            : 'ally'
          : form.faction,
      color:
        form.mode === 'create'
          ? kind === 'npc'
            ? '#EF4444'
            : '#38B29A'
          : form.color,
    });
  }

  openEditActorModal(actor: CollectionActorModel): void {
    this.actorModal.set({
      mode: 'edit',
      actorId: actor.id,
      folderId: actor.folder_id ?? '',
      sourceCharacterId: actor.source_character_id,
      actorKind: actor.actor_kind,
      isUnique: actor.is_unique,
      name: actor.name,
      faction: actor.faction,
      size: actor.size,
      icon: actor.icon ?? 'greatsword',
      color: actor.color ?? '#38B29A',
      maxHp: actor.max_hp,
      maxSp: actor.max_sp,
      maxAp: actor.max_ap,
      armorDr: actor.armor_dr,
      shieldBlock: actor.shield_block,
      moveFeet: actor.move_feet,
      visionFeet: actor.vision_feet,
      darkvisionFeet: resolveActorDarkvisionFeet(
        actor.darkvision_feet,
        actor.npc_stats
      ),
      lightBrightFeet: actor.light_bright_feet,
      lightDimFeet: actor.light_dim_feet,
      lightColor: actor.light_color || '#F59E0B',
      weaponName: actor.npc_stats.weapon_name ?? 'Weapon',
      attackAp: actor.npc_stats.attack_ap ?? 1,
      attackMod: actor.npc_stats.attack_mod ?? 3,
      flatDamage: actor.npc_stats.flat_damage ?? 4,
      reachFeet: actor.npc_stats.reach_feet ?? 5,
      combatTag: actor.npc_stats.combat_tag ?? 'None',
      parryMod: actor.npc_stats.parry_mod ?? 2,
      dodgeMod: actor.npc_stats.dodge_mod ?? 2,
      canDodge: actor.npc_stats.can_dodge !== false,
      notes: actor.notes ?? '',
    });
  }

  closeActorModal(): void {
    this.actorModal.set(null);
  }

  async saveActorModal(): Promise<void> {
    const form = this.actorModal();
    if (!form) return;

    const hasVisionInput =
      form.visionFeet !== null &&
      form.visionFeet !== undefined &&
      String(form.visionFeet).trim() !== '' &&
      Number.isFinite(Number(form.visionFeet));
    const hasDarkvisionInput =
      form.darkvisionFeet !== null &&
      form.darkvisionFeet !== undefined &&
      String(form.darkvisionFeet).trim() !== '' &&
      Number.isFinite(Number(form.darkvisionFeet));

    const draft: ActorTemplateDraft = {
      folder_id: form.folderId || null,
      source_character_id: form.sourceCharacterId,
      actor_kind: form.actorKind,
      is_unique: form.isUnique,
      name: form.name.trim() || 'Unnamed Actor',
      faction: form.faction,
      size: Math.max(1, Number(form.size) || 1),
      icon: form.icon.trim() || 'greatsword',
      color: form.color || '#38B29A',
      max_hp: Math.max(1, Number(form.maxHp) || 10),
      max_sp: Math.max(0, Number(form.maxSp) || 0),
      max_ap: Math.max(1, Number(form.maxAp) || 4),
      armor_dr: Math.max(0, Number(form.armorDr) || 0),
      shield_block: Math.max(0, Number(form.shieldBlock) || 0),
      move_feet: Math.max(0, Number(form.moveFeet) || 20),
      vision_feet: hasVisionInput
        ? Math.max(0, Math.round(Number(form.visionFeet)))
        : DEFAULT_VTT_DIM_VISION_FEET,
      darkvision_feet: hasDarkvisionInput
        ? Math.max(0, Math.round(Number(form.darkvisionFeet)))
        : DEFAULT_VTT_DARKVISION_FEET,
      light_bright_feet: Math.max(0, Number(form.lightBrightFeet) || 0),
      light_dim_feet: Math.max(0, Number(form.lightDimFeet) || 0),
      light_color: form.lightColor || '#F59E0B',
      npc_stats: {
        weapon_name: form.weaponName.trim() || 'Unarmed',
        attack_ap: Math.max(0, Number(form.attackAp) || 1),
        attack_mod: Number(form.attackMod) || 0,
        flat_damage: Math.max(0, Number(form.flatDamage) || 0),
        reach_feet: Math.max(5, Number(form.reachFeet) || 5),
        combat_tag: form.combatTag,
        parry_mod: Number(form.parryMod) || 0,
        dodge_mod: Number(form.dodgeMod) || 0,
        can_dodge: form.canDodge,
      },
      notes: form.notes,
    };

    if (form.mode === 'create') {
      const created = await this.collectionsStore.createActorFromScratch(draft);
      if (created) {
        this.actorModal.set(null);
      }
      return;
    }

    if (form.actorId) {
      const ok = await this.collectionsStore.updateActor(form.actorId, draft);
      if (ok) {
        this.actorModal.set(null);
      }
    }
  }

  openImportModal(): void {
    const activeFilter = this.selectedFolderFilter();
    this.importTargetFolderId.set(
      activeFilter !== 'all' && activeFilter !== 'root' ? activeFilter : ''
    );
    this.importSearch.set('');
    this.importTab.set('characters');
    this.importModalOpen.set(true);
    void this.collectionsStore.loadCollections();
    void this.collectionsStore.ensureMyCharactersLoaded();
  }

  closeImportModal(): void {
    this.importModalOpen.set(false);
  }

  async importCharacter(character: CharacterModel): Promise<void> {
    await this.collectionsStore.importCharacterToCollection(
      character,
      this.importTargetFolderId() || null
    );
  }

  async importPreset(preset: VttNpcPreset): Promise<void> {
    await this.collectionsStore.importNpcPresetToCollection(
      preset,
      this.importTargetFolderId() || null
    );
  }

  onActorDragStart(actor: CollectionActorModel, event: DragEvent): void {
    this.draggingActorId.set(actor.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', actor.id);
    }
  }

  onActorDragEnd(): void {
    this.draggingActorId.set(null);
    this.dragOverTarget.set(null);
  }

  onFolderDragOver(targetKey: string, event: DragEvent): void {
    if (!this.draggingActorId()) return;
    event.preventDefault();
    this.dragOverTarget.set(targetKey);
  }

  onFolderDragLeave(targetKey: string): void {
    if (this.dragOverTarget() === targetKey) {
      this.dragOverTarget.set(null);
    }
  }

  async onFolderDrop(
    folderId: string | null,
    event: DragEvent
  ): Promise<void> {
    event.preventDefault();
    const actorId = this.draggingActorId();
    this.draggingActorId.set(null);
    this.dragOverTarget.set(null);
    if (!actorId) return;
    await this.collectionsStore.moveActorToFolder(actorId, folderId);
  }
}
