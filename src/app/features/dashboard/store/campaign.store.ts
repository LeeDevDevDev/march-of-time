import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { GameCardModel } from '../models/campaign.model';
import { CampaignService } from '../services/campaign.service';

interface CampaignState {
  yourGames: GameCardModel[];
  joinedGames: GameCardModel[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  needsMigration: boolean;
}

@Injectable({ providedIn: 'root' })
export class CampaignStore {
  private readonly campaignService = inject(CampaignService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationStore);

  private loadPromise: Promise<void> | null = null;
  private lastUserId: string | null = null;

  readonly #state = signal<CampaignState>({
    yourGames: [],
    joinedGames: [],
    isLoading: false,
    hasLoaded: false,
    error: null,
    needsMigration: false,
  });

  readonly yourGames = computed(() => this.#state().yourGames);
  readonly joinedGames = computed(() => this.#state().joinedGames);
  readonly isHydrating = computed(
    () => this.#state().isLoading && !this.#state().hasLoaded
  );
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);
  readonly needsMigration = computed(() => this.#state().needsMigration);

  constructor() {
    effect(() => {
      const userId = this.authStore.user()?.id ?? null;
      if (this.lastUserId !== null && userId !== this.lastUserId) {
        this.loadPromise = null;
        this.#state.set({
          yourGames: [],
          joinedGames: [],
          isLoading: false,
          hasLoaded: false,
          error: null,
          needsMigration: false,
        });
      }
      this.lastUserId = userId;
    });
  }

  ensureLoaded(): Promise<void> {
    if (this.#state().hasLoaded) {
      return Promise.resolve();
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const immediateUser = this.authStore.user();
    if (immediateUser) {
      return this.loadGames(immediateUser.id);
    }

    if (this.authStore.isLoading()) {
      this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
      const waitTask = (async () => {
        try {
          await this.authStore.waitForInit();
          const resolvedUser = this.authStore.user();
          if (resolvedUser) {
            await this.fetchGamesInternal(resolvedUser.id);
          } else {
            this.#state.update((s) => ({ ...s, isLoading: false }));
          }
        } finally {
          this.loadPromise = null;
        }
      })();
      this.loadPromise = waitTask;
      return waitTask;
    }

    return Promise.resolve();
  }

  loadGames(userId: string): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));
    const task = (async () => {
      try {
        await this.fetchGamesInternal(userId);
      } finally {
        this.loadPromise = null;
      }
    })();
    this.loadPromise = task;
    return task;
  }

  private async fetchGamesInternal(userId: string): Promise<void> {
    try {
      const res = await this.campaignService.fetchUserCampaigns(userId);
      this.#state.update((s) => ({
        ...s,
        yourGames: res.yourGames,
        joinedGames: res.joinedGames,
        needsMigration: res.needsMigration,
        error: res.error,
        hasLoaded: true,
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({
        ...s,
        hasLoaded: true,
        isLoading: false,
      }));
    }
  }

  async createGame(name: string, coverImageUrl: string): Promise<boolean> {
    const user = this.authStore.user();
    if (!user || !name.trim()) return false;

    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));

    const res = await this.campaignService.insertCampaign({
      name: name.trim(),
      cover_image_url: coverImageUrl.trim() || null,
      gm_id: user.id,
    });

    if (res.error || !res.data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        needsMigration: res.needsMigration,
        error: res.error,
      }));
      return false;
    }

    const created = res.data;
    this.#state.update((s) => ({
      ...s,
      yourGames: [created, ...s.yourGames],
      isLoading: false,
    }));
    this.notifications.success(
      'Campaign Created',
      `"${created.name}" is live. Invite code: ${created.invite_code}`
    );
    return true;
  }

  async joinGameByCode(rawCode: string): Promise<boolean> {
    const user = this.authStore.user();
    const code = rawCode.trim().toUpperCase();
    if (!user || !code) return false;

    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));

    if (typeof this.campaignService.joinCampaignByInvite === 'function') {
      const rpcRes = await this.campaignService.joinCampaignByInvite(code);
      if (!rpcRes.fallback) {
        if (rpcRes.error || !rpcRes.data) {
          this.#state.update((s) => ({
            ...s,
            isLoading: false,
            error: rpcRes.error,
          }));
          if ((rpcRes.error ?? '').toLowerCase().includes('no game found')) {
            this.notifications.error(
              'Invalid Invite Code',
              rpcRes.error ?? `No game found matching code "${code}".`
            );
          }
          return false;
        }

        const joinedCampaign = rpcRes.data;
        this.#state.update((s) => ({
          ...s,
          joinedGames: [joinedCampaign, ...s.joinedGames],
          isLoading: false,
        }));
        this.notifications.success(
          'Joined Campaign',
          `You have joined "${joinedCampaign.name}".`
        );
        return true;
      }
    }

    const foundRes = await this.campaignService.findCampaignByInviteCode(code);

    if (foundRes.error || !foundRes.data) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: foundRes.error,
      }));
      this.notifications.error(
        'Invalid Invite Code',
        foundRes.error ?? `No game found matching code "${code}".`
      );
      return false;
    }

    const campaign = foundRes.data;
    if (campaign.gm_id === user.id) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          'You are the Game Master of this game (it is already in Your Games).',
      }));
      return false;
    }

    const joinErr = await this.campaignService.insertCampaignMember(
      campaign.id,
      user.id
    );

    if (joinErr) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: joinErr,
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      joinedGames: [campaign, ...s.joinedGames],
      isLoading: false,
    }));
    this.notifications.success(
      'Joined Campaign',
      `You have joined "${campaign.name}".`
    );
    return true;
  }

  async markGamePlayed(gameId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.campaignService.updateCampaignLastPlayed(gameId, now);

    this.#state.update((s) => ({
      ...s,
      yourGames: s.yourGames.map((g) =>
        g.id === gameId ? { ...g, last_played_at: now } : g
      ),
      joinedGames: s.joinedGames.map((g) =>
        g.id === gameId ? { ...g, last_played_at: now } : g
      ),
    }));
  }
}
