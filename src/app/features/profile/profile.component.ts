import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.component.html',
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
