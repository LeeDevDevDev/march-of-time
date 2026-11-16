import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CharacterModel,
  DerivedCharacterStats,
  computeDerivedStats,
  hasCustomTokenAppearance,
} from './models/character.model';
import { CharacterStore } from './store/character.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { TokenAvatarComponent } from '../../shared/token-avatar/token-avatar.component';

@Component({
  selector: 'app-characters-list',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent, TokenAvatarComponent],
  templateUrl: './characters-list.component.html',
})
export class CharactersListComponent {
  readonly characterStore = inject(CharacterStore);
  private readonly router = inject(Router);
  readonly pendingDeleteCharacter = signal<CharacterModel | null>(null);
  readonly brokenPortraitIds = signal<Record<string, boolean>>({});

  constructor() {
    void this.characterStore.ensureLoaded();
  }

  hasCustomToken(char: CharacterModel): boolean {
    return (
      Boolean(char.token_image_url) ||
      hasCustomTokenAppearance(char.token_appearance)
    );
  }

  markPortraitError(characterId: string): void {
    this.brokenPortraitIds.update((curr) => ({
      ...curr,
      [characterId]: true,
    }));
  }

  getStats(char: CharacterModel): DerivedCharacterStats {
    const armors =
      typeof this.characterStore.allArmors === 'function'
        ? this.characterStore.allArmors()
        : undefined;
    return computeDerivedStats(
      char,
      this.characterStore.allWeapons(),
      this.characterStore.allPerkNodes(),
      armors
    );
  }

  openSheet(characterId: string): void {
    void this.router.navigate(['/characters', characterId]);
  }

  removeCharacter(char: CharacterModel): void {
    this.pendingDeleteCharacter.set(char);
  }

  cancelDeleteCharacter(): void {
    if (!this.characterStore.isLoading()) {
      this.pendingDeleteCharacter.set(null);
    }
  }

  async confirmDeleteCharacter(): Promise<void> {
    const char = this.pendingDeleteCharacter();
    if (!char) return;
    await this.characterStore.deleteCharacter(char.id);
    this.pendingDeleteCharacter.set(null);
  }
}
