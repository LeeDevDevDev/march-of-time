import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
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
