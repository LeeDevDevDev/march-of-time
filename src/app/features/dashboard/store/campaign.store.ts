import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { GameCardModel } from '../models/campaign.model';
import { CampaignService } from '../services/campaign.service';

interface CampaignState {
  yourGames: GameCardModel[];
  joinedGames: GameCardModel[];
  isLoading: boolean;
  error: string | null;
  needsMigration: boolean;
}

@Injectable({ providedIn: 'root' })
export class CampaignStore {
  private readonly campaignService = inject(CampaignService);
  private readonly authStore = inject(AuthStore);
  private readonly notifications = inject(NotificationStore);

  readonly #state = signal<CampaignState>({
    yourGames: [],
    joinedGames: [],
    isLoading: false,
    error: null,
    needsMigration: false,
  });

  readonly yourGames = computed(() => this.#state().yourGames);
  readonly joinedGames = computed(() => this.#state().joinedGames);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly error = computed(() => this.#state().error);
  readonly needsMigration = computed(() => this.#state().needsMigration);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user) {
        void this.loadGames(user.id);
      } else {
        this.#state.set({
          yourGames: [],
          joinedGames: [],
          isLoading: false,
          error: null,
          needsMigration: false,
        });
      }
    });
  }

  async loadGames(userId: string): Promise<void> {
    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const res = await this.campaignService.fetchUserCampaigns(userId);
      this.#state.update((s) => ({
        ...s,
        yourGames: res.yourGames,
        joinedGames: res.joinedGames,
        needsMigration: res.needsMigration,
        error: res.error,
        isLoading: false,
      }));
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
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
