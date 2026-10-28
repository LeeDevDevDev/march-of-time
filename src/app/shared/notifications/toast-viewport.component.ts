import { Component, inject } from '@angular/core';
import { NotificationStore } from '../../core/notifications/notification.store';

@Component({
  selector: 'app-toast-viewport',
  standalone: true,
  templateUrl: './toast-viewport.component.html',
})
export class ToastViewportComponent {
  readonly notificationStore = inject(NotificationStore);
}
