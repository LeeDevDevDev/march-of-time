import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <section
        class="overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
      >
        <div
          class="flex items-center justify-between border-b border-[#243B37] bg-[#122220] px-6 py-5 sm:px-8"
        >
          <div>
            <h1 class="font-display text-xl font-bold text-white">
              Profile &amp; Handle
            </h1>
            <p class="mt-0.5 text-xs text-[#8AB0AB]">
              Update how other players and Game Masters see you.
            </p>
          </div>

          <a
            routerLink="/dashboard"
            class="rounded-lg border border-[#243B37] bg-[#0D1615] px-3 py-1.5 text-xs font-semibold text-[#EBF5F3] no-underline hover:border-[#C4491A]"
          >
            Back to Games
          </a>
        </div>

        <div class="p-6 sm:p-8 space-y-5">
          @if (authStore.error()) {
            <div
              class="rounded-xl border border-[var(--mot-hp)] bg-[var(--mot-hp-bg)] px-4 py-3 text-xs font-semibold text-[var(--mot-hp-text)]"
            >
              {{ authStore.error() }}
            </div>
          }

          @if (authStore.statusMessage()) {
            <div
              class="rounded-xl border border-[#C4491A] bg-[var(--mot-well)] px-4 py-3 text-xs font-semibold text-[var(--mot-text)]"
            >
              {{ authStore.statusMessage() }}
            </div>
          }

          <form (ngSubmit)="saveProfile()" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-[var(--mot-muted)]">
                Account Email
              </label>
              <div
                class="mt-1.5 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-3.5 py-2.5 font-mono-num text-sm text-[var(--mot-muted)]"
              >
                {{ authStore.user()?.email }}
              </div>
            </div>

            <div>
              <label for="profName" class="block text-xs font-bold text-[var(--mot-text)]">
                Display Name
              </label>
              <input
                id="profName"
                type="text"
                name="displayName"
                required
                [(ngModel)]="displayName"
                class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            <div>
              <label for="profHandle" class="block text-xs font-bold text-[var(--mot-text)]">
                Unique Handle
              </label>
              <div class="relative mt-1.5">
                <span
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-num text-sm font-bold text-[var(--mot-muted)]"
                >
                  &#64;
                </span>
                <input
                  id="profHandle"
                  type="text"
                  name="handle"
                  required
                  [ngModel]="handle"
                  (ngModelChange)="onHandleChange($event)"
                  class="mot-input py-2.5 pl-8 pr-3.5 font-mono-num text-sm font-semibold"
                />
              </div>
              <p class="mt-1 text-xs text-[var(--mot-muted)]">
                Players and Game Masters can find and add you as
                <span class="font-mono-num font-semibold text-[var(--mot-text)]">
                  &#64;{{ handle || 'handle' }}
                </span>
              </p>
            </div>

            <button
              type="submit"
              [disabled]="authStore.isLoading()"
              class="btn-copper rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              @if (authStore.isLoading()) {
                Saving...
              } @else {
                Save Changes
              }
            </button>
          </form>
        </div>
      </section>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  readonly authStore = inject(AuthStore);

  displayName = '';
  handle = '';

  ngOnInit(): void {
    this.authStore.clearMessages();
    this.displayName = this.authStore.displayName();
    this.handle = this.authStore.handle() ?? sanitizeHandle(this.displayName);
  }

  onHandleChange(value: string): void {
    this.handle = sanitizeHandle(value);
  }

  async saveProfile(): Promise<void> {
    await this.authStore.saveProfileAndHandle(this.displayName, this.handle);
  }
}
