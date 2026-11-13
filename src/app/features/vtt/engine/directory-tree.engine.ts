import { VttDirectoryScope, VttFolderModel } from '../models/vtt.model';

export const MAX_DIRECTORY_FOLDER_DEPTH = 3;

export const FOLDER_COLOR_SWATCHES: string[] = [
  '#C4491A',
  '#D97706',
  '#38B29A',
  '#0284C7',
  '#8B5CF6',
  '#E11D48',
  '#64748B',
];

export const MAP_BG_COLOR_SWATCHES: { label: string; color: string }[] = [
  { label: 'Obsidian Slate', color: '#0E1917' },
  { label: 'Deep Abyss', color: '#070B0E' },
  { label: 'Stone Keep', color: '#1C2026' },
  { label: 'Weathered Parchment', color: '#2B231B' },
  { label: 'Verdant Mire', color: '#0F2218' },
  { label: 'Ashen Wastes', color: '#261A18' },
];

export interface DirectoryFolderOption {
  id: string;
  name: string;
  label: string;
  depth: number;
}

export interface DirectoryFolderNode<TItem> {
  folder: VttFolderModel;
  depth: number;
  subfolders: DirectoryFolderNode<TItem>[];
  items: TItem[];
  totalItemCount: number;
}

export interface DirectoryTreeResult<TItem> {
  folders: DirectoryFolderNode<TItem>[];
  rootItems: TItem[];
  flatFolderOptions: DirectoryFolderOption[];
}

export interface BuildDirectoryTreeOptions<TItem> {
  scope: VttDirectoryScope;
  getItemFolderId: (item: TItem) => string | null;
  getItemName: (item: TItem) => string;
  getItemSortOrder?: (item: TItem) => number;
  searchQuery?: string;
}

export function collectDescendantFolderIds(
  rootFolderId: string,
  allFolders: VttFolderModel[]
): Set<string> {
  const result = new Set<string>();
  const queue: string[] = [rootFolderId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const f of allFolders) {
      if (f.parent_folder_id === current && !result.has(f.id)) {
        result.add(f.id);
        queue.push(f.id);
      }
    }
  }

  return result;
}

export function getFolderDepth(
  folderId: string,
  byId: Map<string, VttFolderModel>
): number {
  let depth = 0;
  const visited = new Set<string>([folderId]);
  let cursor = byId.get(folderId)?.parent_folder_id ?? null;

  while (cursor && byId.has(cursor) && !visited.has(cursor)) {
    visited.add(cursor);
    depth += 1;
    cursor = byId.get(cursor)?.parent_folder_id ?? null;
  }

  return depth;
}

function getMaxSubtreeDepth(
  folderId: string,
  scopedFolders: VttFolderModel[],
  visited = new Set<string>()
): number {
  if (visited.has(folderId)) return 0;
  visited.add(folderId);

  let maxChild = 0;
  for (const f of scopedFolders) {
    if (f.parent_folder_id === folderId) {
      maxChild = Math.max(
        maxChild,
        1 + getMaxSubtreeDepth(f.id, scopedFolders, new Set(visited))
      );
    }
  }
  return maxChild;
}

export function canNestFolderInside(
  folderId: string | null,
  candidateParentId: string | null,
  allFolders: VttFolderModel[],
  scope: VttDirectoryScope
): boolean {
  if (!candidateParentId) return true;
  if (folderId && folderId === candidateParentId) return false;

  const scoped = allFolders.filter((f) => f.scope === scope);
  const byId = new Map(scoped.map((f) => [f.id, f]));
  if (!byId.has(candidateParentId)) return false;

  if (folderId) {
    const descendants = collectDescendantFolderIds(folderId, scoped);
    if (descendants.has(candidateParentId)) return false;
  }

  const parentDepth = getFolderDepth(candidateParentId, byId);
  const ownSubtreeSpan = folderId
    ? getMaxSubtreeDepth(folderId, scoped)
    : 0;

  return parentDepth + 1 + ownSubtreeSpan < MAX_DIRECTORY_FOLDER_DEPTH;
}

export function buildDirectoryTree<TItem>(
  allFolders: VttFolderModel[],
  allItems: TItem[],
  options: BuildDirectoryTreeOptions<TItem>
): DirectoryTreeResult<TItem> {
  const scopedFolders = allFolders
    .filter((f) => f.scope === options.scope)
    .slice()
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name);
    });

  const folderById = new Map<string, VttFolderModel>();
  for (const f of scopedFolders) {
    folderById.set(f.id, f);
  }

  const validParentMap = new Map<string, string | null>();
  for (const f of scopedFolders) {
    const parentId = f.parent_folder_id;
    if (!parentId || !folderById.has(parentId) || parentId === f.id) {
      validParentMap.set(f.id, null);
      continue;
    }

    const seen = new Set<string>([f.id]);
    let cursor: string | null = parentId;
    let hasCycle = false;
    let depth = 0;

    while (cursor && folderById.has(cursor)) {
      if (seen.has(cursor)) {
        hasCycle = true;
        break;
      }
      seen.add(cursor);
      depth += 1;
      cursor = folderById.get(cursor)?.parent_folder_id ?? null;
    }

    if (hasCycle || depth >= MAX_DIRECTORY_FOLDER_DEPTH) {
      validParentMap.set(f.id, null);
    } else {
      validParentMap.set(f.id, parentId);
    }
  }

  const sortItems = (list: TItem[]): TItem[] =>
    list.slice().sort((a, b) => {
      const sa = options.getItemSortOrder ? options.getItemSortOrder(a) : 0;
      const sb = options.getItemSortOrder ? options.getItemSortOrder(b) : 0;
      if (sa !== sb) return sa - sb;
      return options.getItemName(a).localeCompare(options.getItemName(b));
    });

  const q = (options.searchQuery ?? '').trim().toLowerCase();
  const itemMatches = (item: TItem): boolean =>
    !q || options.getItemName(item).toLowerCase().includes(q);

  const itemsByFolder = new Map<string, TItem[]>();
  const rawRootItems: TItem[] = [];

  for (const item of sortItems(allItems)) {
    const fid = options.getItemFolderId(item);
    if (fid && folderById.has(fid)) {
      const bucket = itemsByFolder.get(fid) ?? [];
      bucket.push(item);
      itemsByFolder.set(fid, bucket);
    } else {
      rawRootItems.push(item);
    }
  }

  const childrenByParent = new Map<string | null, VttFolderModel[]>();
  for (const f of scopedFolders) {
    const pid = validParentMap.get(f.id) ?? null;
    const list = childrenByParent.get(pid) ?? [];
    list.push(f);
    childrenByParent.set(pid, list);
  }

  const flatFolderOptions: DirectoryFolderOption[] = [];
  const collectFlatOptions = (parentId: string | null, depth: number): void => {
    const children = childrenByParent.get(parentId) ?? [];
    for (const child of children) {
      const prefix = depth > 0 ? `${'  '.repeat(depth - 1)}↳ ` : '';
      flatFolderOptions.push({
        id: child.id,
        name: child.name,
        label: `${prefix}${child.name}`,
        depth,
      });
      collectFlatOptions(child.id, depth + 1);
    }
  };
  collectFlatOptions(null, 0);

  const buildFolderNode = (
    folder: VttFolderModel,
    depth: number,
    ancestorMatchedSearch: boolean
  ): DirectoryFolderNode<TItem> | null => {
    const selfMatches = Boolean(q && folder.name.toLowerCase().includes(q));
    const passAllChildren = !q || ancestorMatchedSearch || selfMatches;

    const childFolders = childrenByParent.get(folder.id) ?? [];
    const builtSubfolders: DirectoryFolderNode<TItem>[] = [];
    for (const cf of childFolders) {
      const built = buildFolderNode(cf, depth + 1, passAllChildren);
      if (built) {
        builtSubfolders.push(built);
      }
    }

    const ownAll = itemsByFolder.get(folder.id) ?? [];
    const ownFiltered = passAllChildren ? ownAll : ownAll.filter(itemMatches);

    if (q && !passAllChildren && ownFiltered.length === 0 && builtSubfolders.length === 0) {
      return null;
    }

    const totalItemCount =
      ownFiltered.length +
      builtSubfolders.reduce((acc, sub) => acc + sub.totalItemCount, 0);

    return {
      folder,
      depth,
      subfolders: builtSubfolders,
      items: ownFiltered,
      totalItemCount,
    };
  };

  const rootFolders: DirectoryFolderNode<TItem>[] = [];
  for (const rf of childrenByParent.get(null) ?? []) {
    const built = buildFolderNode(rf, 0, false);
    if (built) {
      rootFolders.push(built);
    }
  }

  const filteredRootItems = q ? rawRootItems.filter(itemMatches) : rawRootItems;

  return {
    folders: rootFolders,
    rootItems: filteredRootItems,
    flatFolderOptions,
  };
}
