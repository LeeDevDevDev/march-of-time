export interface GameCardModel {
  id: string;
  name: string;
  cover_image_url: string | null;
  gm_id: string;
  invite_code: string;
  last_played_at: string | null;
  created_at: string;
  membership_role?: 'gm' | 'player';
  member_count?: number;
  scene_count?: number;
}
