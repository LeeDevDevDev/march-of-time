import { Injectable, computed, signal } from '@angular/core';

export type NotificationTone = 'success' | 'info' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  callback: () => void | Promise<void>;
}

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  message?: string;
  createdAt: string;
  read: boolean;
  dismissedToast: boolean;
  action?: NotificationAction;
}

interface NotificationState {
  items: AppNotification[];
  drawerOpen: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly #state = signal<NotificationState>({
    items: [],
    drawerOpen: false,
  });

  readonly history = computed(() => this.#state().items);
  readonly activeToasts = computed(() =>
    this.#state()
      .items.filter((item) => !item.dismissedToast)
      .slice(0, 4)
  );
  readonly unreadCount = computed(
    () => this.#state().items.filter((item) => !item.read).length
  );
  readonly drawerOpen = computed(() => this.#state().drawerOpen);

  notify(input: {
    tone?: NotificationTone;
    title: string;
    message?: string;
    durationMs?: number;
    action?: NotificationAction;
  }): string {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: AppNotification = {
      id,
      tone: input.tone ?? 'info',
      title: input.title,
      message: input.message,
      createdAt: new Date().toISOString(),
      read: false,
      dismissedToast: false,
      action: input.action,
    };

    this.#state.update((s) => ({
      ...s,
      items: [entry, ...s.items].slice(0, 30),
    }));

    const duration = input.durationMs ?? (input.action ? 6500 : 4200);
    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismissToast(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  success(title: string, message?: string, action?: NotificationAction): string {
    return this.notify({ tone: 'success', title, message, action });
  }

  info(title: string, message?: string, action?: NotificationAction): string {
    return this.notify({ tone: 'info', title, message, action });
  }

  warning(title: string, message?: string, action?: NotificationAction): string {
    return this.notify({ tone: 'warning', title, message, action });
  }

  error(title: string, message?: string): string {
    return this.notify({
      tone: 'error',
      title,
      message,
      durationMs: 6500,
    });
  }

  dismissToast(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.#state.update((s) => ({
      ...s,
      items: s.items.map((item) =>
        item.id === id ? { ...item, dismissedToast: true } : item
      ),
    }));
  }

  triggerAction(item: AppNotification): void {
    if (!item.action) return;
    const cb = item.action.callback;
    this.#state.update((s) => ({
      ...s,
      items: s.items.map((n) =>
        n.id === item.id
          ? { ...n, read: true, dismissedToast: true, action: undefined }
          : n
      ),
    }));
    void cb();
  }

  toggleDrawer(): void {
    const nextOpen = !this.#state().drawerOpen;
    this.#state.update((s) => ({
      ...s,
      drawerOpen: nextOpen,
      items: nextOpen ? s.items.map((n) => ({ ...n, read: true })) : s.items,
    }));
  }

  closeDrawer(): void {
    if (this.#state().drawerOpen) {
      this.#state.update((s) => ({ ...s, drawerOpen: false }));
    }
  }

  markAllRead(): void {
    this.#state.update((s) => ({
      ...s,
      items: s.items.map((n) => ({ ...n, read: true })),
    }));
  }

  clearHistory(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.#state.update((s) => ({
      ...s,
      items: [],
    }));
  }
}
