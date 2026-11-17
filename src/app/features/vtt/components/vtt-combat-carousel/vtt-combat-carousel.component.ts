import { Component, computed, inject, signal } from '@angular/core';
import { TokenAvatarComponent } from '../../../../shared/token-avatar/token-avatar.component';
import { VttTokenModel } from '../../models/vtt.model';
import { VttStore } from '../../store/vtt.store';

@Component({
  selector: 'app-vtt-combat-carousel',
  standalone: true,
  imports: [TokenAvatarComponent],
  templateUrl: './vtt-combat-carousel.component.html',
})
export class VttCombatCarouselComponent {
  readonly vttStore = inject(VttStore);

  readonly minimized = signal<boolean>(false);
  readonly brokenPortraitUrls = signal<Record<string, boolean>>({});

  readonly scene = computed(() => this.vttStore.activeScene());
  readonly combatants = computed(() => this.vttStore.enrolledCombatTokens());
  readonly unrolledControllableTokens = computed(() =>
    this.vttStore.unrolledControllableTokens()
  );

  readonly shouldRender = computed<boolean>(() =>
    Boolean(this.scene()?.combat_active)
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

  getDisplayPortraitUrl(tok: VttTokenModel): string | null {
    const vis = this.vttStore.resolveTokenVisuals(tok);
    const url = vis.portraitUrl;
    if (!url || this.brokenPortraitUrls()[url]) return null;
    return url;
  }

  markPortraitBroken(url: string): void {
    this.brokenPortraitUrls.update((curr) => ({ ...curr, [url]: true }));
  }

  getTokenVisuals(tok: VttTokenModel) {
    return this.vttStore.resolveTokenVisuals(tok);
  }

  getHpPercent(tok: VttTokenModel): number {
    if (tok.max_hp <= 0) return 0;
    return Math.max(0, Math.min(100, (tok.current_hp / tok.max_hp) * 100));
  }

  getSpPercent(tok: VttTokenModel): number {
    if (tok.max_sp <= 0) return 0;
    return Math.max(0, Math.min(100, (tok.current_sp / tok.max_sp) * 100));
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
    const pct = this.getHpPercent(tok);
    if (pct >= 80) return 'Unhurt';
    if (pct >= 45) return 'Wounded';
    return 'Critical';
  }

  hasRolledInitiative(tok: VttTokenModel): boolean {
    return typeof tok.npc_stats?.__initiative === 'number';
  }

  isTokenSelected(tokenId: string): boolean {
    return this.vttStore.selectedTokenIds().includes(tokenId);
  }

  canControlOrGm(tok: VttTokenModel): boolean {
    return this.vttStore.isGm() || this.vttStore.canControlToken(tok);
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

  toggleMinimized(): void {
    this.minimized.update((v) => !v);
  }

  toggleTrackerWindow(): void {
    this.vttStore.toggleCombatTrackerDrawer();
  }

  async rollMyInitiative(): Promise<void> {
    await this.vttStore.rollInitiativeForMyTokens();
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
}
