import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <section
        class="overflow-hidden rounded-2xl border border-[var(--mot-border)] bg-[var(--mot-surface)]"
      >
        <!-- Deep Night-Pine Architectural Banner -->
        <div class="border-b border-[#243B37] bg-[#122220] px-6 py-6 sm:px-8">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C4491A] font-display text-sm font-bold text-white"
            >
              MoT
            </div>
            <div>
              <h1 class="font-display text-xl font-bold text-white">
                {{ mode() === 'signup' ? 'Create Your Chronicle Account' : 'Sign In to March of Time' }}
              </h1>
              <p class="mt-0.5 text-xs text-[#8AB0AB]">
                {{
                  mode() === 'signup'
                    ? 'Claim your @handle to host campaigns or join a table.'
                    : 'Welcome back to your tactical campaigns.'
                }}
              </p>
            </div>
          </div>
        </div>

        <div class="p-6 sm:p-8 space-y-5">
          <!-- Mode Switcher (Defaults to Create Account) -->
          <div
            class="grid grid-cols-2 rounded-xl border border-[var(--mot-border)] bg-[var(--mot-well)] p-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              (click)="switchMode('signup')"
              [class]="
                mode() === 'signup'
                  ? 'btn-copper rounded-lg py-2 text-xs font-semibold'
                  : 'rounded-lg py-2 text-xs font-semibold text-[var(--mot-muted)] hover:text-[var(--mot-text)]'
              "
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              (click)="switchMode('signin')"
              [class]="
                mode() === 'signin'
                  ? 'btn-copper rounded-lg py-2 text-xs font-semibold'
                  : 'rounded-lg py-2 text-xs font-semibold text-[var(--mot-muted)] hover:text-[var(--mot-text)]'
              "
            >
              Sign In
            </button>
          </div>

          @if (validationError() || authStore.error()) {
            <div
              class="rounded-xl border border-[var(--mot-hp)] bg-[var(--mot-hp-bg)] px-4 py-3 text-xs font-semibold text-[var(--mot-hp-text)]"
            >
              {{ validationError() ?? authStore.error() }}
            </div>
          }

          @if (authStore.statusMessage()) {
            <div
              class="rounded-xl border border-[#C4491A] bg-[var(--mot-well)] px-4 py-3 text-xs font-semibold text-[var(--mot-text)]"
            >
              {{ authStore.statusMessage() }}
            </div>
          }

          <form (ngSubmit)="submitForm()" class="space-y-4">
            @if (mode() === 'signup') {
              <div>
                <label for="displayName" class="block text-xs font-bold text-[var(--mot-text)]">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  name="displayName"
                  required
                  [(ngModel)]="displayName"
                  placeholder="e.g., Kaelen Vance"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
                />
              </div>

              <div>
                <label for="handle" class="block text-xs font-bold text-[var(--mot-text)]">
                  Unique Handle
                </label>
                <div class="relative mt-1.5">
                  <span
                    class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono-num text-sm font-bold text-[var(--mot-muted)]"
                  >
                    &#64;
                  </span>
                  <input
                    id="handle"
                    type="text"
                    name="handle"
                    required
                    [ngModel]="handle"
                    (ngModelChange)="onHandleInput($event)"
                    placeholder="kaelen_vance"
                    class="mot-input py-2.5 pl-8 pr-3.5 font-mono-num text-sm font-semibold"
                  />
                </div>
                <p class="mt-1 text-xs text-[var(--mot-muted)]">
                  3–24 lowercase letters, numbers, or underscores. Friends can add you as
                  <span class="font-mono-num font-semibold text-[var(--mot-text)]">
                    &#64;{{ handle || 'handle' }}
                  </span>
                </p>
              </div>
            }

            <div>
              <label for="email" class="block text-xs font-bold text-[var(--mot-text)]">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                [(ngModel)]="email"
                placeholder="you@example.com"
                class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            <div>
              <label for="password" class="block text-xs font-bold text-[var(--mot-text)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                required
                minlength="6"
                [(ngModel)]="password"
                placeholder="At least 6 characters"
                class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
              />
            </div>

            @if (mode() === 'signup') {
              <div>
                <label for="confirmPassword" class="block text-xs font-bold text-[var(--mot-text)]">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  required
                  minlength="6"
                  [(ngModel)]="confirmPassword"
                  placeholder="Re-enter your password"
                  class="mot-input mt-1.5 px-3.5 py-2.5 text-sm font-medium"
                />
              </div>
            }

            <button
              type="submit"
              [disabled]="authStore.isLoading()"
              class="btn-copper w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
            >
              @if (authStore.isLoading()) {
                Please wait...
              } @else {
                {{ mode() === 'signup' ? 'Create Account' : 'Sign In' }}
              }
            </button>
          </form>

          <div class="relative flex items-center justify-center">
            <div class="w-full border-t border-[var(--mot-border)]"></div>
            <span class="bg-[var(--mot-surface)] px-3 text-xs font-medium text-[var(--mot-muted)]">
              or
            </span>
            <div class="w-full border-t border-[var(--mot-border)]"></div>
          </div>

          <button
            type="button"
            (click)="authStore.signInWithGoogle()"
            class="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--mot-border)] bg-[var(--mot-well)] px-4 py-2.5 text-sm font-semibold text-[var(--mot-text)] hover:border-[#C4491A]"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
            Continue with Google
          </button>
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  readonly authStore = inject(AuthStore);

  readonly mode = signal<'signup' | 'signin'>('signup');
  readonly validationError = signal<string | null>(null);

  displayName = '';
  handle = '';
  email = '';
  password = '';
  confirmPassword = '';

  onHandleInput(value: string): void {
    this.handle = sanitizeHandle(value);
  }

  switchMode(next: 'signup' | 'signin'): void {
    this.validationError.set(null);
    this.authStore.clearMessages();
    this.mode.set(next);
  }

  async submitForm(): Promise<void> {
    this.validationError.set(null);
    if (!this.email.trim() || !this.password.trim()) return;

    if (this.mode() === 'signup') {
      const cleanHandle = sanitizeHandle(this.handle);
      if (cleanHandle.length < 3) {
        this.validationError.set(
          'Handle must be at least 3 characters (lowercase letters, numbers, or underscores).'
        );
        return;
      }
      if (this.password.length < 6) {
        this.validationError.set('Password must be at least 6 characters.');
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.validationError.set('Passwords do not match. Please re-enter your password.');
        return;
      }
      await this.authStore.signUpWithEmail(
        this.email.trim(),
        this.password,
        this.displayName.trim(),
        cleanHandle
      );
    } else {
      await this.authStore.signInWithEmail(this.email.trim(), this.password);
    }
  }
}
