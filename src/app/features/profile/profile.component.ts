import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserAssetsStore } from '../../core/assets/user-assets.store';
import { sanitizeHandle } from '../../core/auth/auth.model';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationStore } from '../../core/notifications/notification.store';
import {
  DEFAULT_VTT_HOTKEYS,
  VTT_HOTKEY_META,
  VttHotkeyAction,
  VttSettingsStore,
  formatHotkeyBadge,
  normalizeKeyComboFromEvent,
} from '../../core/settings/vtt-settings.store';
import { AssetBrowserModalComponent } from '../../shared/asset-browser/asset-browser-modal.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, RouterLink, AssetBrowserModalComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  readonly authStore = inject(AuthStore);
  readonly settingsStore = inject(VttSettingsStore);
  readonly userAssetsStore = inject(UserAssetsStore);
  private readonly notifications = inject(NotificationStore);

  readonly hotkeyMeta = VTT_HOTKEY_META;
  readonly formatBadge = formatHotkeyBadge;
  readonly recordingAction = signal<VttHotkeyAction | null>(null);
  readonly assetLibraryOpen = signal(false);

  displayName = '';
  handle = '';

  ngOnInit(): void {
    this.authStore.clearMessages();
    this.displayName = this.authStore.displayName();
    this.handle = this.authStore.handle() ?? sanitizeHandle(this.displayName);
    void this.userAssetsStore.ensureLoaded();
  }

  onHandleChange(value: string): void {
    this.handle = sanitizeHandle(value);
  }

  async saveProfile(): Promise<void> {
    await this.authStore.saveProfileAndHandle(this.displayName, this.handle);
  }

  startRecordingHotkey(action: VttHotkeyAction): void {
    this.recordingAction.set(
      this.recordingAction() === action ? null : action
    );
  }

  isDefaultHotkey(action: VttHotkeyAction): boolean {
    return this.settingsStore.hotkeys()[action] === DEFAULT_VTT_HOTKEYS[action];
  }

  resetSingleHotkey(action: VttHotkeyAction): void {
    this.recordingAction.set(null);
    this.settingsStore.resetHotkey(action);
  }

  resetAllHotkeys(): void {
    this.recordingAction.set(null);
    this.settingsStore.resetAllHotkeys();
    this.notifications.info(
      'Hotkeys Reset',
      'Restored default VTT keyboard shortcuts.'
    );
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    const recording = this.recordingAction();
    if (!recording) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === 'Escape') {
      this.recordingAction.set(null);
      return;
    }

    const combo = normalizeKeyComboFromEvent(event);
    if (!combo) return;

    const res = this.settingsStore.setHotkey(recording, combo);
    if (!res.applied) {
      this.notifications.error(
        'Reserved Key',
        res.reason ?? 'Cannot bind that shortcut.'
      );
      return;
    }
    this.recordingAction.set(null);
    if (res.swappedWith) {
      const swapped = VTT_HOTKEY_META.find(
        (m) => m.action === res.swappedWith
      );
      this.notifications.info(
        'Shortcut Swapped',
        `Swapped binding with ${swapped?.label ?? res.swappedWith}.`
      );
    }
  }
}
