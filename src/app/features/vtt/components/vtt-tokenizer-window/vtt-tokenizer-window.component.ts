import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { UserAssetModel } from '../../../../core/assets/user-assets.model';
import { resolveWeaponVisuals } from '../../../../core/compendium/compendium.model';
import { AssetBrowserModalComponent } from '../../../../shared/asset-browser/asset-browser-modal.component';
import {
  TokenizerAssetPickerRequest,
  TokenizerEditorComponent,
  TokenizerVisualsPayload,
} from '../../../../shared/token-avatar/tokenizer-editor.component';
import {
  TokenAppearanceConfig,
  VttFaction,
  resolveActorTokenDisplayName,
  resolveEntityPortraitUrl,
  resolveEntityTokenAppearance,
  resolveEntityTokenImageUrl,
} from '../../models/vtt.model';
import { VttStore } from '../../store/vtt.store';
import { VttFloatingWindowComponent } from '../vtt-floating-window/vtt-floating-window.component';

@Component({
  selector: 'app-vtt-tokenizer-window',
  standalone: true,
  imports: [
    AssetBrowserModalComponent,
    TokenizerEditorComponent,
    VttFloatingWindowComponent,
  ],
  templateUrl: './vtt-tokenizer-window.component.html',
})
export class VttTokenizerWindowComponent {
  readonly vttStore = inject(VttStore);

  readonly floatingWindow = viewChild(VttFloatingWindowComponent);

  readonly activeAssetPickerRequest =
    signal<TokenizerAssetPickerRequest | null>(null);

  readonly displayNameDraft = signal<string>('');

  readonly isOpen = computed<boolean>(() => {
    if (!this.vttStore.openTokenizerTarget()) return false;
    return Boolean(
      this.vttStore.openTokenizerCharacter() ||
        this.vttStore.openTokenizerRosterActor() ||
        this.vttStore.openTokenizerToken()
    );
  });

  readonly canEdit = computed<boolean>(() =>
    this.vttStore.canEditOpenTokenizer()
  );

  readonly mode = computed<'character' | 'npc'>(() => {
    if (this.vttStore.openTokenizerCharacter()) return 'character';
    const actor = this.vttStore.openTokenizerRosterActor();
    if (actor) {
      return actor.actor_kind === 'npc' ? 'npc' : 'character';
    }
    const tok = this.vttStore.openTokenizerToken();
    if (this.vttStore.resolveCharacterForToken(tok)) return 'character';
    return 'npc';
  });

  readonly sheetName = computed<string>(() => {
    return (
      this.vttStore.openTokenizerCharacter()?.name ??
      this.vttStore.openTokenizerRosterActor()?.name ??
      this.vttStore.openTokenizerToken()?.name ??
      'Actor'
    );
  });

  readonly displayTokenName = computed<string>(() => {
    const tok = this.vttStore.openTokenizerToken();
    if (tok) return tok.name;
    const actor = this.vttStore.openTokenizerRosterActor();
    const char = this.vttStore.openTokenizerCharacter();
    if (actor) {
      return resolveActorTokenDisplayName(actor, char?.name);
    }
    return char?.name ?? 'Actor';
  });

  readonly hasCustomDisplayName = computed<boolean>(() => {
    const hasSheetIdentity = Boolean(
      this.vttStore.openTokenizerCharacter() ||
        this.vttStore.openTokenizerRosterActor()
    );
    if (!hasSheetIdentity) return false;
    return this.displayTokenName().trim() !== this.sheetName().trim();
  });

  readonly targetName = computed<string>(() => {
    return this.displayTokenName();
  });

  readonly resolvedVisuals = computed<{
    portraitUrl: string | null;
    tokenImageUrl: string | null;
    tokenAppearance: TokenAppearanceConfig;
  }>(() => {
    const char = this.vttStore.openTokenizerCharacter();
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    if (char) {
      return {
        portraitUrl: resolveEntityPortraitUrl(char, actor, tok),
        tokenImageUrl: resolveEntityTokenImageUrl(char, actor, tok),
        tokenAppearance: resolveEntityTokenAppearance(char, actor, tok),
      };
    }
    return {
      portraitUrl: resolveEntityPortraitUrl(tok, actor),
      tokenImageUrl: resolveEntityTokenImageUrl(tok, actor),
      tokenAppearance: resolveEntityTokenAppearance(tok, actor),
    };
  });

  readonly fallbackIcon = computed<string>(() => {
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    const stats = this.vttStore.openTokenizerDerived();
    if (actor?.icon) return actor.icon;
    if (tok?.icon) return tok.icon;
    if (stats?.activeWeapon) {
      return resolveWeaponVisuals(stats.activeWeapon).icon;
    }
    return this.mode() === 'npc' ? 'battleaxe' : 'greatsword';
  });

  readonly fallbackColor = computed<string>(() => {
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    if (actor?.color) return actor.color;
    if (tok?.color) return tok.color;
    return this.mode() === 'npc' ? '#EF4444' : '#38B29A';
  });

  readonly faction = computed<VttFaction>(() => {
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    return actor?.faction ?? tok?.faction ?? 'ally';
  });

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const liveName = this.displayTokenName();
      if (open) {
        this.displayNameDraft.set(liveName);
      }
    });

    effect(() => {
      const tick = this.vttStore.openTokenizerFocusTick();
      const open = this.isOpen();
      if (!open) {
        this.activeAssetPickerRequest.set(null);
        return;
      }
      if (tick > 0) {
        untracked(() => {
          queueMicrotask(() => {
            this.floatingWindow()?.focusWindow();
          });
        });
      }
    });
  }

  async commitDisplayName(): Promise<void> {
    if (!this.canEdit()) return;
    const trimmed = this.displayNameDraft().trim();
    if (!trimmed) {
      this.displayNameDraft.set(this.displayTokenName());
      return;
    }
    if (trimmed === this.displayTokenName()) return;
    await this.vttStore.updateTokenizerDisplayName(trimmed);
  }

  async resetDisplayName(): Promise<void> {
    if (!this.canEdit()) return;
    await this.vttStore.resetTokenizerDisplayName();
    this.displayNameDraft.set(this.displayTokenName());
  }

  openAssetPicker(req: TokenizerAssetPickerRequest): void {
    if (!this.canEdit()) return;
    this.activeAssetPickerRequest.set(req);
  }

  closeAssetPicker(): void {
    this.activeAssetPickerRequest.set(null);
  }

  onAssetSelected(asset: UserAssetModel): void {
    const req = this.activeAssetPickerRequest();
    this.activeAssetPickerRequest.set(null);
    if (req && asset?.public_url) {
      req.apply(asset.public_url);
    }
  }

  async onVisualsChange(payload: TokenizerVisualsPayload): Promise<void> {
    if (!this.canEdit()) return;
    const char = this.vttStore.openTokenizerCharacter();
    if (this.mode() === 'character' && char) {
      await this.vttStore.updateCharacterFromVttSheet(char.id, (c) => ({
        ...c,
        portrait_url: payload.portrait_url,
        token_image_url: payload.token_image_url,
        token_appearance: payload.token_appearance,
      }));
      return;
    }
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    await this.vttStore.updateNpcFromVttSheet(
      actor?.id ?? null,
      tok?.id ?? null,
      {
        portrait_url: payload.portrait_url,
        token_image_url: payload.token_image_url,
        token_appearance: payload.token_appearance,
      }
    );
  }

  async setDisposition(nextFaction: VttFaction): Promise<void> {
    if (!this.vttStore.isGm()) return;
    const actor = this.vttStore.openTokenizerRosterActor();
    const tok = this.vttStore.openTokenizerToken();
    await this.vttStore.updateNpcFromVttSheet(
      actor?.id ?? null,
      tok?.id ?? null,
      { faction: nextFaction }
    );
  }

  async closeStudio(): Promise<void> {
    await this.commitDisplayName();
    this.activeAssetPickerRequest.set(null);
    this.vttStore.closeTokenizerStudio();
  }
}
