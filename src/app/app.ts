import { Component, HostListener, inject, signal } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { ThemeStore } from './core/theme/theme.store';
import { KeywordTooltipOverlayComponent } from './shared/keyword-text/keyword-tooltip-overlay.component';
import { KeywordTooltipService } from './shared/keyword-text/keyword-tooltip.service';
import { ToastViewportComponent } from './shared/notifications/toast-viewport.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastViewportComponent,
    KeywordTooltipOverlayComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly authStore = inject(AuthStore);
  readonly themeStore = inject(ThemeStore);
  private readonly keywordTooltip = inject(KeywordTooltipService);
  private readonly router = inject(Router);

  readonly userMenuOpen = signal(false);

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  openProfile(): void {
    this.userMenuOpen.set(false);
    void this.router.navigate(['/profile']);
  }

  toggleThemeFromMenu(): void {
    this.themeStore.toggleSheetTheme(this.authStore.user()?.id);
  }

  async signOutFromMenu(): Promise<void> {
    this.userMenuOpen.set(false);
    await this.authStore.signOut();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
    }
    this.keywordTooltip.hideImmediately();
  }
}
