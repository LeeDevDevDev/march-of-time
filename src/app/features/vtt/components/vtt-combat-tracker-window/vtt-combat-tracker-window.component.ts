import { Component, computed, inject } from '@angular/core';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import { VttTokenModel } from '../../models/vtt.model';
import { VttStore } from '../../store/vtt.store';
import { VttFloatingWindowComponent } from '../vtt-floating-window/vtt-floating-window.component';

@Component({
  selector: 'app-vtt-combat-tracker-window',
  standalone: true,
  imports: [TokenAvatarComponent, VttFloatingWindowComponent],
  templateUrl: './vtt-combat-tracker-window.component.html',
})
export class VttCombatTrackerWindowComponent {
  readonly vttStore = inject(VttStore);

  readonly scene = computed(() => this.vttStore.activeScene());
  readonly combatants = computed(() => this.vttStore.enrolledCombatTokens());
  readonly unrolledSceneTokens = computed(() =>
    this.vttStore.unrolledSceneTokens()
  );
  readonly unrolledControllableTokens = computed(() =>
    this.vttStore.unrolledControllableTokens()
  );

  readonly shouldRender = computed<boolean>(
    () => Boolean(this.scene()) && this.vttStore.combatTrackerDrawerOpen()
  );

  readonly initialX = computed<number>(
    () => this.vttStore.combatTrackerPosition()?.x ?? 140
  );

  readonly initialY = computed<number>(
    () => this.vttStore.combatTrackerPosition()?.y ?? 64
  );

  readonly activeTurnToken = computed<VttTokenModel | null>(() => {
    const sc = this.scene();
    if (!sc?.combat_active || !sc.active_turn_token_id) return null;
    return (
      this.vttStore
        .sceneTokens()
        .find((t) => t.id === sc.active_turn_token_id) ?? null
    );
  });

  readonly canAdvanceTurn = computed<boolean>(() => {
    const sc = this.scene();
    if (!sc?.combat_active) return false;
    if (this.vttStore.isGm()) return true;
    const active = this.activeTurnToken();
    return Boolean(active && this.vttStore.canControlToken(active));
  });

  readonly unrolledSelectedIds = computed<string[]>(() => {
    const enrolledSet = new Set(
      this.vttStore.allEnrolledCombatTokens().map((t) => t.id)
    );
    return this.vttStore
      .selectedTokenIds()
      .filter((id) => !enrolledSet.has(id));
  });

  getTokenVisuals(tok: VttTokenModel) {
    return this.vttStore.resolveTokenVisuals(tok);
  }

  canSeeExactVitals(tok: VttTokenModel): boolean {
    return (
      this.vttStore.isGm() ||
      tok.faction === 'ally' ||
      this.vttStore.canControlToken(tok)
    );
  }

  getVitalConditionLabel(tok: VttTokenModel): string {
    if (tok.current_hp <= 0) return 'Defeated';
    const pct = tok.max_hp > 0 ? (tok.current_hp / tok.max_hp) * 100 : 0;
    if (pct >= 80) return 'Unhurt';
    if (pct >= 45) return 'Wounded';
    return 'Critical';
  }

  getInitiativeModLabel(tok: VttTokenModel): string {
    const mod =
      typeof tok.npc_stats?.__initiative_mod === 'number'
        ? tok.npc_stats.__initiative_mod
        : this.vttStore.resolveTokenInitiativeInfo(tok).mod;
    return mod >= 0 ? `+${mod}` : `−${Math.abs(mod)}`;
  }

  hasRolledInitiative(tok: VttTokenModel): boolean {
    return typeof tok.npc_stats?.__initiative === 'number';
  }

  canControlOrGm(tok: VttTokenModel): boolean {
    return this.vttStore.isGm() || this.vttStore.canControlToken(tok);
  }

  isTokenSelected(tokenId: string): boolean {
    return this.vttStore.selectedTokenIds().includes(tokenId);
  }

  selectCombatant(tok: VttTokenModel, event: MouseEvent): void {
    event.stopPropagation();
    if (event.shiftKey) {
      this.vttStore.toggleTokenInSelection(tok.id);
      return;
    }
    this.vttStore.setSelectedTokens([tok.id]);
  }

  openCombatantSheet(tok: VttTokenModel, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.canControlOrGm(tok)) return;
    this.vttStore.openTokenSheet(tok.id);
  }

  closeTracker(): void {
    this.vttStore.toggleCombatTrackerDrawer(false);
  }

  onPositionChange(coords: { x: number; y: number }): void {
    this.vttStore.saveCombatTrackerPosition(coords);
  }

  onMinimizedChange(minimized: boolean): void {
    this.vttStore.saveCombatTrackerMinimized(minimized);
  }

  async rollMyInitiative(): Promise<void> {
    await this.vttStore.rollInitiativeForMyTokens();
  }

  async rollNpcs(): Promise<void> {
    await this.vttStore.rollInitiativeForSceneNpcs();
  }

  async rollAll(): Promise<void> {
    await this.vttStore.rollInitiativeForAllSceneTokens();
  }

  async addSelectedToCombat(): Promise<void> {
    const ids = this.unrolledSelectedIds();
    if (ids.length === 0) return;
    await this.vttStore.addTokensToCombat(ids);
  }

  async rollSingleToken(tokenId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.vttStore.rollInitiativeForTokens([tokenId]);
  }

  async addSingleToken(tokenId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.vttStore.addTokensToCombat([tokenId]);
  }

  async initiatePhase1(): Promise<void> {
    await this.vttStore.initiateCombatPhase();
  }

  async beginCombat(): Promise<void> {
    await this.vttStore.startCombatEncounter();
  }

  async clearLobby(): Promise<void> {
    await this.vttStore.clearInitiativeLobby();
  }

  async nextTurn(): Promise<void> {
    await this.vttStore.advanceTurn();
  }

  async prevTurn(): Promise<void> {
    await this.vttStore.previousTurn();
  }

  async endCombat(): Promise<void> {
    await this.vttStore.endCombatEncounter();
  }

  async activateTurn(tokenId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.vttStore.setActiveCombatTurn(tokenId);
  }

  async removeCombatant(tokenId: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.vttStore.removeTokenFromCombat(tokenId);
  }

  async stepInitiativeScore(
    tok: VttTokenModel,
    delta: number,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();
    const base =
      typeof tok.npc_stats?.__initiative === 'number'
        ? tok.npc_stats.__initiative
        : 0;
    await this.vttStore.setTokenInitiativeScore(tok.id, base + delta);
  }

  selectScoreInput(event: FocusEvent): void {
    const inputEl = event.target as HTMLInputElement | null;
    inputEl?.select();
  }

  onScoreKeyDown(event: KeyboardEvent, tok: VttTokenModel): void {
    event.stopPropagation();
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      void this.stepInitiativeScore(tok, 1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      void this.stepInitiativeScore(tok, -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const inputEl = event.target as HTMLInputElement | null;
      if (inputEl) {
        void this.commitInitiativeScore(tok.id, inputEl.value);
        inputEl.blur();
      }
    }
  }

  onScoreChange(event: Event, tokenId: string): void {
    event.stopPropagation();
    const inputEl = event.target as HTMLInputElement | null;
    if (!inputEl) return;
    void this.commitInitiativeScore(tokenId, inputEl.value);
  }

  private async commitInitiativeScore(
    tokenId: string,
    rawValue: string
  ): Promise<void> {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      await this.vttStore.setTokenInitiativeScore(tokenId, null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    await this.vttStore.setTokenInitiativeScore(tokenId, parsed);
  }
}
