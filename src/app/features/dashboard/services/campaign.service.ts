import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { GameCardModel } from '../models/campaign.model';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly supabase = inject(SupabaseService).client;

  async fetchUserCampaigns(userId: string): Promise<{
    yourGames: GameCardModel[];
    joinedGames: GameCardModel[];
    needsMigration: boolean;
    error: string | null;
  }> {
    const { data: ownedData, error: ownedErr } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('gm_id', userId)
      .order('created_at', { ascending: false });

    if (ownedErr) {
      return {
        yourGames: [],
        joinedGames: [],
        needsMigration: ownedErr.code === 'PGRST205',
        error: ownedErr.code === 'PGRST205' ? null : ownedErr.message,
      };
    }

    const { data: memberRows, error: memberErr } = await this.supabase
      .from('campaign_members')
      .select('campaign_id, campaigns(*)')
      .eq('user_id', userId);

    if (memberErr && memberErr.code !== 'PGRST205') {
      return {
        yourGames: (ownedData as GameCardModel[]) ?? [],
        joinedGames: [],
        needsMigration: false,
        error: memberErr.message,
      };
    }

    const joined: GameCardModel[] = [];
    if (Array.isArray(memberRows)) {
      for (const row of memberRows as unknown as {
        campaigns: GameCardModel | null;
      }[]) {
        if (row.campaigns && row.campaigns.gm_id !== userId) {
          joined.push(row.campaigns);
        }
      }
    }

    return {
      yourGames: (ownedData as GameCardModel[]) ?? [],
      joinedGames: joined,
      needsMigration: false,
      error: null,
    };
  }

  async insertCampaign(input: {
    name: string;
    cover_image_url: string | null;
    gm_id: string;
  }): Promise<{
    data: GameCardModel | null;
    needsMigration: boolean;
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .insert(input)
      .select('*')
      .single();

    if (error || !data) {
      return {
        data: null,
        needsMigration: error?.code === 'PGRST205',
        error: error?.message ?? 'Unable to create campaign.',
      };
    }

    return {
      data: data as GameCardModel,
      needsMigration: false,
      error: null,
    };
  }

  async findCampaignByInviteCode(code: string): Promise<{
    data: GameCardModel | null;
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();

    if (error || !data) {
      return {
        data: null,
        error: error?.message ?? `No game found with invite code "${code}".`,
      };
    }

    return {
      data: data as GameCardModel,
      error: null,
    };
  }

  async insertCampaignMember(
    campaignId: string,
    userId: string
  ): Promise<string | null> {
    const { error } = await this.supabase.from('campaign_members').insert({
      campaign_id: campaignId,
      user_id: userId,
    });

    if (error) {
      return error.code === '23505'
        ? 'You have already joined this game.'
        : error.message;
    }
    return null;
  }

  async updateCampaignLastPlayed(gameId: string, isoTimestamp: string): Promise<void> {
    await this.supabase
      .from('campaigns')
      .update({ last_played_at: isoTimestamp })
      .eq('id', gameId);
  }
}
