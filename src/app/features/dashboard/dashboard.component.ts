import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { CampaignStore } from './store/campaign.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly authStore = inject(AuthStore);
  readonly campaignStore = inject(CampaignStore);
  private readonly router = inject(Router);

  readonly showCreateForm = signal(false);
  readonly showJoinForm = signal(false);
  readonly copiedCode = signal<string | null>(null);

  newGameName = '';
  newCoverUrl = '';
  joinCode = '';

  constructor() {
    void this.campaignStore.ensureLoaded();
    this.prefillInviteFromUrl();
  }

  private prefillInviteFromUrl(): void {
    try {
      const urlTree = this.router.parseUrl?.(this.router.url);
      const rawInvite = urlTree?.queryParams?.['invite'];
      if (typeof rawInvite === 'string' && rawInvite.trim().length > 0) {
        this.joinCode = rawInvite.trim().toUpperCase();
        this.showCreateForm.set(false);
        this.showJoinForm.set(true);
      }
    } catch {
      return;
    }
  }

  openCreateDrawer(): void {
    this.showJoinForm.set(false);
    this.showCreateForm.update((open) => !open);
  }

  openJoinDrawer(): void {
    this.showCreateForm.set(false);
    this.showJoinForm.update((open) => !open);
  }

  copyInviteCode(code: string): void {
    void navigator.clipboard?.writeText(code);
    this.copiedCode.set(code);
    setTimeout(() => {
      if (this.copiedCode() === code) {
        this.copiedCode.set(null);
      }
    }, 1800);
  }

  async submitCreateGame(): Promise<void> {
    const ok = await this.campaignStore.createGame(this.newGameName, this.newCoverUrl);
    if (ok) {
      this.newGameName = '';
      this.newCoverUrl = '';
      this.showCreateForm.set(false);
    }
  }

  async submitJoinGame(): Promise<void> {
    const ok = await this.campaignStore.joinGameByCode(this.joinCode);
    if (ok) {
      this.joinCode = '';
      this.showJoinForm.set(false);
    }
  }

  launchGame(gameId: string): void {
    void this.campaignStore.markGamePlayed(gameId);
    void this.router.navigate(['/vtt', gameId]);
  }
}
