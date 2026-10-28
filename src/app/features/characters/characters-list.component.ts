import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  CharacterModel,
  DerivedCharacterStats,
  computeDerivedStats,
} from './models/character.model';
import { CharacterStore } from './store/character.store';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-characters-list',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './characters-list.component.html',
})
export class CharactersListComponent {
  readonly characterStore = inject(CharacterStore);
  private readonly router = inject(Router);
  readonly pendingDeleteCharacter = signal<CharacterModel | null>(null);

  getStats(char: CharacterModel): DerivedCharacterStats {
    return computeDerivedStats(
      char,
      this.characterStore.allWeapons(),
      this.characterStore.allPerkNodes()
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
