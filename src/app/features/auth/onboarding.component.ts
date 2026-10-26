import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <section
        class="overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
      >
        <div class="border-b border-[#243B37] bg-[#122220] px-6 py-6 sm:px-8">
          <h1 class="font-display text-xl font-bold text-white">
            Complete Your Profile
          </h1>
          <p class="mt-1 text-xs text-[#8AB0AB]">
            Set your display name and unique <span class="font-mono-num">&#64;handle</span> so players and GMs can find you.
          </p>
        </div>

        <div class="p-6 sm:p-8 space-y-5">
          @if (authStore.error()) {
            <div
              class="rounded-xl border border-[var(--mot-hp)] bg-[var(--mot-hp-bg)] px-4 py-3 text-xs font-semibold text-[var(--mot-hp-text)]"
            >
              {{ authStore.error() }}
            </div>
          }

          <form (ngSubmit)="submitOnboarding()" class="space-y-4">
            <div>
              <label for="onboardName" class="block text-xs font-bold text-[var(--mot-text)]">
                Display Name
              </label>
              <input
                id="onboardName"
                type="text"
                name="displayName"
                required
                [(ngModel)]="displayName"
                placeholder="Your Display Name"
                class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            <div>
              <label for="onboardHandle" class="block text-xs font-bold text-[var(--mot-text)]">
                Unique Handle
              </label>
              <div class="relative mt-1.5">
                <span
                  class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-num text-sm font-bold text-[var(--mot-muted)]"
                >
                  &#64;
                </span>
                <input
                  id="onboardHandle"
                  type="text"
                  name="handle"
                  required
                  [ngModel]="handle"
                  (ngModelChange)="onHandleChange($event)"
                  placeholder="Your Unique Handler"
                  class="mot-input py-2.5 pl-8 pr-3.5 font-mono-num text-sm font-semibold"
                />
              </div>
              <p class="mt-1 text-xs text-[var(--mot-muted)]">
                3–24 lowercase letters, numbers, or underscores. You will appear as
                <span class="font-mono-num font-semibold text-[var(--mot-text)]">
                  &#64;{{ handle || 'handle' }}
                </span>
              </p>
            </div>

            <button
              type="submit"
              [disabled]="authStore.isLoading()"
              class="btn-copper w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              @if (authStore.isLoading()) {
                Saving Profile...
              } @else {
                Continue to Dashboard
              }
            </button>
          </form>
        </div>
      </section>
    </div>
  `,
})
export class OnboardingComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  displayName = '';
  handle = '';

  ngOnInit(): void {
    this.authStore.clearMessages();
    this.displayName = this.authStore.displayName();
    this.handle = sanitizeHandle(this.displayName);
  }

  onHandleChange(value: string): void {
    this.handle = sanitizeHandle(value);
  }

  async submitOnboarding(): Promise<void> {
    const ok = await this.authStore.saveProfileAndHandle(this.displayName, this.handle);
    if (ok) {
      await this.router.navigate(['/dashboard']);
    }
  }
}
