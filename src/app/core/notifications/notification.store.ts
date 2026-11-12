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
  action?: NotificationAction;
}

interface NotificationState {
  toasts: AppNotification[];
  inbox: AppNotification[];
  drawerOpen: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly #state = signal<NotificationState>({
    toasts: [],
    inbox: [],
    drawerOpen: false,
  });

  readonly activeToasts = computed(() => this.#state().toasts.slice(0, 4));
  readonly history = computed(() => this.#state().inbox);
  readonly unreadCount = computed(
    () => this.#state().inbox.filter((item) => !item.read).length
  );
  readonly drawerOpen = computed(() => this.#state().drawerOpen);

  notify(input: {
    tone?: NotificationTone;
    title: string;
    message?: string;
    durationMs?: number;
    action?: NotificationAction;
    persistInInbox?: boolean;
  }): string {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: AppNotification = {
      id,
      tone: input.tone ?? 'info',
      title: input.title,
      message: input.message,
      createdAt: new Date().toISOString(),
      read: false,
      action: input.action,
    };

    this.#state.update((s) => ({
      ...s,
      toasts: [entry, ...s.toasts].slice(0, 8),
      inbox: input.persistInInbox
        ? [entry, ...s.inbox].slice(0, 30)
        : s.inbox,
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

  pushInboxNotification(input: {
    tone?: NotificationTone;
    title: string;
    message?: string;
    action?: NotificationAction;
    alsoToast?: boolean;
  }): string {
    if (input.alsoToast !== false) {
      return this.notify({
        ...input,
        persistInInbox: true,
      });
    }

    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: AppNotification = {
      id,
      tone: input.tone ?? 'info',
      title: input.title,
      message: input.message,
      createdAt: new Date().toISOString(),
      read: false,
      action: input.action,
    };

    this.#state.update((s) => ({
      ...s,
      inbox: [entry, ...s.inbox].slice(0, 30),
    }));
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
      toasts: s.toasts.filter((item) => item.id !== id),
    }));
  }

  triggerAction(item: AppNotification): void {
    if (!item.action) return;
    const cb = item.action.callback;
    const timer = this.timers.get(item.id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(item.id);
    }
    this.#state.update((s) => ({
      ...s,
      toasts: s.toasts.filter((t) => t.id !== item.id),
      inbox: s.inbox.map((n) =>
        n.id === item.id ? { ...n, read: true, action: undefined } : n
      ),
    }));
    void cb();
  }

  toggleDrawer(): void {
    const nextOpen = !this.#state().drawerOpen;
    this.#state.update((s) => ({
      ...s,
      drawerOpen: nextOpen,
      inbox: nextOpen ? s.inbox.map((n) => ({ ...n, read: true })) : s.inbox,
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
      inbox: s.inbox.map((n) => ({ ...n, read: true })),
    }));
  }

  clearHistory(): void {
    this.#state.update((s) => ({
      ...s,
      inbox: [],
    }));
  }
}
