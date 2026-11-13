import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import {
  ActiveCombatTag,
  CombatStatusEffect,
  formatWeaponRequirementLabel,
  getCombatTagBadgeClass,
} from '../../core/compendium/compendium.model';
import { ThemeStore } from '../../core/theme/theme.store';
import { CompendiumIconComponent } from '../../shared/compendium-icon/compendium-icon.component';
import {
  CharacterModel,
  ResolvedCombatArt,
} from '../characters/models/character.model';
import { VttCanvasComponent } from './components/vtt-canvas/vtt-canvas.component';
import { HEX_SQRT3, getHexRadius } from './engine/hex-grid.engine';
import {
  VTT_NPC_PRESETS,
  VttDefenseChoice,
  VttFaction,
  VttNpcPreset,
  VttTokenModel,
  VttToolMode,
  VttWallKind,
} from './models/vtt.model';
import { VttStore } from './store/vtt.store';

export type VttSidebarTab = 'log' | 'roster' | 'map';

@Component({
  selector: 'app-vtt-room',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    CompendiumIconComponent,
    VttCanvasComponent,
  ],
  templateUrl: './vtt-room.component.html',
})
export class VttRoomComponent {
  readonly vttStore = inject(VttStore);
  readonly authStore = inject(AuthStore);
  readonly themeStore = inject(ThemeStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly canvasComp = viewChild<VttCanvasComponent>('vttCanvas');
  readonly logScrollEl = viewChild<ElementRef<HTMLDivElement>>('logScroll');

  readonly npcPresets = VTT_NPC_PRESETS;
  readonly statusOptions: Exclude<CombatStatusEffect, 'None'>[] = [
    'Sundered',
    'Staggered',
    'Bleeding',
    'Pinned',
  ];

  readonly sidebarOpen = signal(true);
  readonly sidebarTab = signal<VttSidebarTab>('log');
  readonly dockCollapsed = signal(false);
  readonly migrationBannerDismissed = signal(false);
  readonly showNewSceneForm = signal(false);
  readonly showCustomNpcForm = signal(false);
  readonly copiedInvite = signal(false);

  newSceneName = '';
  newSceneWidth = 18;
  newSceneHeight = 12;

  mapUrlInput = '';

  quickDiceMod = 0;
  quickDiceMode: 'normal' | 'advantage' | 'disadvantage' = 'normal';
  chatText = '';

  manualAttackTotalInput: number | null = null;
  manualDefenseTotalInput: number | null = null;

  overrideHitLanded = true;
  overrideSpDmg = 0;
  overrideHpDmg = 0;
  overrideCounterSp = 0;
  overrideDefAp = 0;
  private syncedResolutionKey: string | null = null;

  customNpcName = 'Bandit Cutthroat';
  customNpcFaction: VttFaction = 'enemy';
  customNpcHp = 8;
  customNpcSp = 4;
  customNpcDr = 1;
  customNpcBlock = 0;
  customNpcMoveFeet = 20;
  customNpcAttackMod = 3;
  customNpcDamage = 4;
  customNpcReachFeet = 5;
  customNpcTag: ActiveCombatTag | 'None' = 'None';

  readonly formatWeaponReq = formatWeaponRequirementLabel;
  readonly tagBadgeClass = getCombatTagBadgeClass;

  readonly deployableCharacters = computed<CharacterModel[]>(() => {
    const uid = this.authStore.user()?.id;
    const all = this.vttStore.allCharacters();
    if (this.vttStore.isGm()) {
      return all;
    }
    return all.filter((c) => c.owner_id === uid);
  });

  readonly visibleRosterTokens = computed<VttTokenModel[]>(() => {
    const all = this.vttStore.sceneTokens();
    if (this.vttStore.isGm()) return all;
    return all.filter((t) => !t.is_hidden || this.vttStore.canControlToken(t));
  });

  readonly canRespondToClash = computed<boolean>(() => {
    if (this.vttStore.isGm()) return true;
    const def = this.vttStore.pendingClashDefender();
    return this.vttStore.canControlToken(def);
  });

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const campaignId = params.get('campaignId');
      if (campaignId) {
        void this.vttStore.enterCampaignRoom(campaignId);
      }
    });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
      this.vttStore.leaveRoom();
    });

    effect(() => {
      const sc = this.vttStore.activeScene();
      if (sc) {
        this.mapUrlInput = sc.map_image_url ?? '';
      }
    });

    effect(() => {
      const clash = this.vttStore.pendingClash();
      const res = clash?.resolution;
      if (!clash || !res) {
        this.syncedResolutionKey = null;
        return;
      }
      const key = `${clash.id}-${clash.selectedReaction}-${res.summary}`;
      if (this.syncedResolutionKey !== key) {
        this.syncedResolutionKey = key;
        this.overrideHitLanded = res.hitLanded;
        this.overrideSpDmg = res.spDamageToDefender;
        this.overrideHpDmg = res.hpDamageToDefender;
        this.overrideCounterSp = res.counterSpToAttacker;
        this.overrideDefAp = res.defenderApSpent;
      }
    });

    effect(() => {
      this.vttStore.logs();
      queueMicrotask(() => {
        const el = this.logScrollEl()?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  selectTool(mode: VttToolMode): void {
    this.vttStore.activeTool.set(mode);
  }

  selectWallKind(kind: VttWallKind): void {
    this.vttStore.activeWallKind.set(kind);
  }

  copyInviteCode(): void {
    const code = this.vttStore.campaign()?.invite_code;
    if (!code) return;
    void navigator.clipboard?.writeText(code);
    this.copiedInvite.set(true);
    setTimeout(() => this.copiedInvite.set(false), 1800);
  }

  onSceneSelectChange(sceneId: string): void {
    if (!sceneId) return;
    void this.vttStore.selectOrActivateScene(sceneId, this.vttStore.isGm());
  }

  async submitNewScene(): Promise<void> {
    if (!this.newSceneName.trim()) return;
    await this.vttStore.createNewScene(
      this.newSceneName,
      this.newSceneWidth,
      this.newSceneHeight
    );
    this.newSceneName = '';
    this.showNewSceneForm.set(false);
  }

  async onMapFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.vttStore.uploadActiveSceneMap(file);
    input.value = '';
  }

  async applyExternalMapUrl(): Promise<void> {
    const sc = this.vttStore.activeScene();
    if (!sc || !this.vttStore.isGm()) return;
    const trimmed = this.mapUrlInput.trim() || null;
    await this.vttStore.patchScene(sc.id, { map_image_url: trimmed });
  }

  async clearSceneMapImage(): Promise<void> {
    const sc = this.vttStore.activeScene();
    if (!sc || !this.vttStore.isGm()) return;
    this.mapUrlInput = '';
    await this.vttStore.patchScene(sc.id, { map_image_url: null });
  }

  async matchGridToMapImage(): Promise<void> {
    const sc = this.vttStore.activeScene();
    const nat = this.canvasComp()?.mapNaturalSize();
    if (!sc || !nat || !this.vttStore.isGm()) return;

    const R = getHexRadius(sc.grid_size_px);
    const estCols = Math.max(
      6,
      Math.min(60, Math.round((nat.width - 2 * R) / (1.5 * R)) + 1)
    );
    const estRows = Math.max(
      6,
      Math.min(60, Math.round(nat.height / (HEX_SQRT3 * R)))
    );

    await this.vttStore.patchScene(sc.id, {
      grid_width: estCols,
      grid_height: estRows,
      grid_offset_x: 0,
      grid_offset_y: 0,
    });
    this.canvasComp()?.fitMapToViewport();
  }

  updateSceneNumberField(
    field:
      | 'grid_width'
      | 'grid_height'
      | 'grid_size_px'
      | 'grid_offset_x'
      | 'grid_offset_y'
      | 'grid_opacity',
    rawValue: number | string
  ): void {
    const sc = this.vttStore.activeScene();
    if (!sc || !this.vttStore.isGm()) return;
    const num = Number(rawValue);
    if (Number.isNaN(num)) return;
    void this.vttStore.patchScene(sc.id, { [field]: num });
  }

  toggleSceneBoolean(field: 'fog_enabled' | 'global_illumination'): void {
    const sc = this.vttStore.activeScene();
    if (!sc || !this.vttStore.isGm()) return;
    void this.vttStore.patchScene(sc.id, { [field]: !sc[field] });
    if (field === 'global_illumination' || field === 'fog_enabled') {
      queueMicrotask(() => this.vttStore.syncExploredFogFromObservers());
    }
  }

  isCharacterDeployed(characterId: string): VttTokenModel | undefined {
    return this.vttStore.sceneTokens().find((t) => t.character_id === characterId);
  }

  async submitCustomNpc(): Promise<void> {
    const preset: VttNpcPreset = {
      id: `custom-${Date.now()}`,
      name: this.customNpcName.trim() || 'Custom Combatant',
      faction: this.customNpcFaction,
      icon: this.customNpcFaction === 'ally' ? 'bastion-shield' : 'battleaxe',
      color:
        this.customNpcFaction === 'ally'
          ? '#38B29A'
          : this.customNpcFaction === 'neutral'
            ? '#F59E0B'
            : '#EF4444',
      max_hp: Math.max(1, Number(this.customNpcHp) || 6),
      max_sp: Math.max(0, Number(this.customNpcSp) || 4),
      max_ap: 4,
      armor_dr: Math.max(0, Number(this.customNpcDr) || 0),
      shield_block: Math.max(0, Number(this.customNpcBlock) || 0),
      move_feet: Math.max(5, Number(this.customNpcMoveFeet) || 20),
      vision_feet: 60,
      npc_stats: {
        weapon_name: 'Signature Strike',
        attack_ap: 1,
        attack_mod: Number(this.customNpcAttackMod) || 3,
        flat_damage: Math.max(1, Number(this.customNpcDamage) || 4),
        reach_feet: Math.max(5, Number(this.customNpcReachFeet) || 5),
        combat_tag: this.customNpcTag,
        parry_mod: 2,
        dodge_mod: 2,
        can_dodge: true,
      },
    };
    await this.vttStore.spawnNpcPreset(preset, preset.name);
    this.showCustomNpcForm.set(false);
  }

  adjustTokenStat(
    tok: VttTokenModel,
    stat: 'current_hp' | 'current_sp' | 'current_ap',
    delta: number
  ): void {
    if (!this.vttStore.canControlToken(tok)) return;
    const maxVal =
      stat === 'current_hp'
        ? tok.max_hp
        : stat === 'current_sp'
          ? tok.max_sp
          : tok.max_ap;
    const next = Math.max(0, Math.min(maxVal, tok[stat] + delta));
    void this.vttStore.patchToken(tok.id, { [stat]: next });
  }

  setTokenTorchPreset(tok: VttTokenModel, mode: 'off' | 'lantern' | 'torch'): void {
    if (!this.vttStore.canControlToken(tok)) return;
    if (mode === 'off') {
      void this.vttStore.patchToken(tok.id, {
        light_bright_feet: 0,
        light_dim_feet: 0,
      });
    } else if (mode === 'lantern') {
      void this.vttStore.patchToken(tok.id, {
        light_bright_feet: 15,
        light_dim_feet: 30,
        light_color: '#FBBF24',
      });
    } else {
      void this.vttStore.patchToken(tok.id, {
        light_bright_feet: 20,
        light_dim_feet: 40,
        light_color: '#FF9B42',
      });
    }
    queueMicrotask(() => this.vttStore.syncExploredFogFromObservers());
  }

  onManualAttackInputChange(val: string | number | null): void {
    if (val === '' || val === null || val === undefined) {
      this.manualAttackTotalInput = null;
      this.vttStore.manualRollOverride.set(null);
      return;
    }
    const num = Number(val);
    if (!Number.isNaN(num)) {
      this.manualAttackTotalInput = num;
      this.vttStore.manualRollOverride.set(num);
    }
  }

  triggerArtFromDock(tok: VttTokenModel, art: ResolvedCombatArt): void {
    const stats = this.vttStore.selectedTokenDerived();
    if (!stats) return;
    const char = this.vttStore.selectedTokenCharacter();
    const cd = this.vttStore.getPerkCooldown(char, art.baseNode.id);
    if (cd > 0 || tok.current_ap < art.apCost || !art.meetsWeaponRequirement) {
      return;
    }
    this.vttStore.beginCombatArtTargetSelection(tok, art, stats);
  }

  chooseClashReaction(choice: VttDefenseChoice): void {
    void this.vttStore.declareClashReaction(choice, this.manualDefenseTotalInput);
    this.manualDefenseTotalInput = null;
  }

  rechooseClashReaction(): void {
    const sc = this.vttStore.activeScene();
    const clash = this.vttStore.pendingClash();
    if (!sc || !clash) return;
    void this.vttStore.patchScene(sc.id, {
      pending_clash: {
        ...clash,
        selectedReaction: undefined,
        resolution: undefined,
      },
    });
  }

  confirmApplyClashOutcome(): void {
    void this.vttStore.applyPendingClashOutcome({
      hitLanded: this.overrideHitLanded,
      spDamageToDefender: Math.max(0, Number(this.overrideSpDmg) || 0),
      hpDamageToDefender: Math.max(0, Number(this.overrideHpDmg) || 0),
      counterSpToAttacker: Math.max(0, Number(this.overrideCounterSp) || 0),
      defenderApSpent: Math.max(0, Number(this.overrideDefAp) || 0),
    });
  }

  async triggerQuickDiceRoll(): Promise<void> {
    const sel = this.vttStore.selectedToken();
    const prefix = sel ? `${sel.name} · Check` : '2d10 Check';
    await this.vttStore.rollQuickDice(
      prefix,
      Number(this.quickDiceMod) || 0,
      this.quickDiceMode
    );
  }

  async sendChatMessage(): Promise<void> {
    const msg = this.chatText.trim();
    if (!msg) return;
    this.chatText = '';
    await this.vttStore.postLog({
      kind: 'chat',
      title: msg,
    });
  }
}
