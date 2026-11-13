export const USER_ASSETS_BUCKET = 'user-assets';

export type UserAssetPurpose = 'maps' | 'characters' | 'general';

export interface UserAssetFolderModel {
  id: string;
  owner_id: string;
  parent_folder_id: string | null;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
  created_at?: string;
}

export interface UserAssetModel {
  id: string;
  owner_id: string;
  folder_id: string | null;
  name: string;
  storage_bucket: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
  folder_name?: string | null;
  folder_slug?: string | null;
  folder_color?: string | null;
}

export interface UserAssetPreferencesModel {
  owner_id: string;
  maps_folder_id: string | null;
  characters_folder_id: string | null;
}

export interface UserAssetBreadcrumb {
  id: string | null;
  name: string;
  color: string | null;
}

export function slugifyAssetSegment(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || 'folder';
}

export function formatAssetByteSize(bytes: number): string {
  const safe = Math.max(0, Number(bytes) || 0);
  if (safe === 0) return '';
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(safe < 10240 ? 1 : 0)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractAssetDisplayNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'Image';
  if (trimmed.startsWith('data:image/')) {
    return 'Embedded Image';
  }
  try {
    const cleanPath = trimmed.split('?')[0].split('#')[0];
    const lastSeg = decodeURIComponent(cleanPath.split('/').pop() || '').trim();
    if (!lastSeg) return 'Image';
    const strippedTimestamp = lastSeg.replace(/^\d{10,14}-/, '');
    return strippedTimestamp || lastSeg;
  } catch {
    return 'Image';
  }
}

export function buildFolderLineage(
  folderId: string | null,
  folders: UserAssetFolderModel[]
): UserAssetFolderModel[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const trail: UserAssetFolderModel[] = [];
  const visited = new Set<string>();
  let cursor: string | null = folderId;

  while (cursor && byId.has(cursor) && !visited.has(cursor)) {
    visited.add(cursor);
    const folder: UserAssetFolderModel = byId.get(cursor)!;
    trail.unshift(folder);
    cursor = folder.parent_folder_id;
  }
  return trail;
}

export function buildUserStorageFolderPrefix(
  userId: string,
  folderId: string | null,
  folders: UserAssetFolderModel[]
): string {
  const lineage = buildFolderLineage(folderId, folders);
  if (lineage.length === 0) return userId;
  const slugPath = lineage.map((f) => f.slug || slugifyAssetSegment(f.name)).join('/');
  return `${userId}/${slugPath}`;
}

export function buildUserFolderBreadcrumbs(
  userRootLabel: string,
  folderId: string | null,
  folders: UserAssetFolderModel[]
): UserAssetBreadcrumb[] {
  const crumbs: UserAssetBreadcrumb[] = [
    { id: null, name: userRootLabel, color: null },
  ];
  for (const folder of buildFolderLineage(folderId, folders)) {
    crumbs.push({
      id: folder.id,
      name: folder.name,
      color: folder.color,
    });
  }
  return crumbs;
}

export function buildUserFolderDisplayTrail(
  userRootLabel: string,
  folderId: string | null,
  folders: UserAssetFolderModel[]
): string {
  return buildUserFolderBreadcrumbs(userRootLabel, folderId, folders)
    .map((c) => c.name)
    .join(' / ');
}
