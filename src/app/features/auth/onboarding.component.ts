import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './onboarding.component.html',
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
