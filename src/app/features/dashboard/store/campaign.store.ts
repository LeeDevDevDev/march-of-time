import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { GameCardModel } from '../models/campaign.model';

interface CampaignState {
  yourGames: GameCardModel[];
  joinedGames: GameCardModel[];
  isLoading: boolean;
  error: string | null;
  needsMigration: boolean;
}

@Injectable({ providedIn: 'root' })
export class CampaignStore {
  private readonly supabase = inject(SupabaseService).client;
  private readonly authStore = inject(AuthStore);

  // Private encapsulated Signal State — starts genuinely empty, no fake data
  readonly #state = signal<CampaignState>({
    yourGames: [],
    joinedGames: [],
    isLoading: false,
    error: null,
    needsMigration: false,
  });

  // Public Readonly Computed Selectors
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
      // 1. Fetch "Your Games" (where signed-in user is the GM)
      const { data: ownedData, error: ownedErr } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('gm_id', userId)
        .order('created_at', { ascending: false });

      if (ownedErr) {
        if (ownedErr.code === 'PGRST205') {
          this.#state.update((s) => ({
            ...s,
            isLoading: false,
            needsMigration: true,
          }));
          return;
        }
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error: ownedErr.message,
        }));
        return;
      }

      // 2. Fetch "Games You Are In" (where signed-in user is a member)
      const { data: memberRows, error: memberErr } = await this.supabase
        .from('campaign_members')
        .select('campaign_id, campaigns(*)')
        .eq('user_id', userId);

      if (memberErr && memberErr.code !== 'PGRST205') {
        this.#state.update((s) => ({
          ...s,
          isLoading: false,
          error: memberErr.message,
        }));
        return;
      }

      const joined: GameCardModel[] = [];
      if (Array.isArray(memberRows)) {
        for (const row of memberRows as unknown as { campaigns: GameCardModel | null }[]) {
          if (row.campaigns && row.campaigns.gm_id !== userId) {
            joined.push(row.campaigns);
          }
        }
      }

      this.#state.update((s) => ({
        ...s,
        yourGames: (ownedData as GameCardModel[]) ?? [],
        joinedGames: joined,
        isLoading: false,
        needsMigration: false,
      }));
    } catch {
      this.#state.update((s) => ({ ...s, isLoading: false }));
    }
  }

  async createGame(name: string, coverImageUrl: string): Promise<boolean> {
    const user = this.authStore.user();
    if (!user || !name.trim()) return false;

    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));

    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        name: name.trim(),
        cover_image_url: coverImageUrl.trim() || null,
        gm_id: user.id,
      })
      .select('*')
      .single();

    if (error) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        needsMigration: error.code === 'PGRST205',
        error: error.message,
      }));
      return false;
    }

    const created = data as GameCardModel;
    this.#state.update((s) => ({
      ...s,
      yourGames: [created, ...s.yourGames],
      isLoading: false,
    }));
    return true;
  }

  async joinGameByCode(rawCode: string): Promise<boolean> {
    const user = this.authStore.user();
    const code = rawCode.trim().toUpperCase();
    if (!user || !code) return false;

    this.#state.update((s) => ({ ...s, isLoading: true, error: null }));

    const { data: found, error: findErr } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();

    if (findErr || !found) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: findErr?.message ?? `No game found with invite code "${code}".`,
      }));
      return false;
    }

    const campaign = found as GameCardModel;
    if (campaign.gm_id === user.id) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error: 'You are the Game Master of this game (it is already in Your Games).',
      }));
      return false;
    }

    const { error: joinErr } = await this.supabase.from('campaign_members').insert({
      campaign_id: campaign.id,
      user_id: user.id,
    });

    if (joinErr) {
      this.#state.update((s) => ({
        ...s,
        isLoading: false,
        error:
          joinErr.code === '23505'
            ? 'You have already joined this game.'
            : joinErr.message,
      }));
      return false;
    }

    this.#state.update((s) => ({
      ...s,
      joinedGames: [campaign, ...s.joinedGames],
      isLoading: false,
    }));
    return true;
  }

  async markGamePlayed(gameId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('campaigns')
      .update({ last_played_at: now })
      .eq('id', gameId);

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
