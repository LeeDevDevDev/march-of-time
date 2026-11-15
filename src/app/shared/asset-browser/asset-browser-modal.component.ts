import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  UserAssetModel,
  UserAssetPurpose,
  formatAssetByteSize,
} from '../../core/assets/user-assets.model';
import { UserAssetsStore } from '../../core/assets/user-assets.store';
import { NotificationStore } from '../../core/notifications/notification.store';
import {
  DirectoryFolderOption,
  FOLDER_COLOR_SWATCHES,
  collectDescendantFolderIds,
} from '../../features/vtt/engine/directory-tree.engine';
import { ColorPickerComponent } from '../color-picker/color-picker.component';
import {
  allocateFloatingWindowId,
  clampFloatingWindowCoords,
  computeFloatingWindowZIndex,
  computeInitialFloatingWindowCoords,
  focusFloatingWindow,
  releaseFloatingWindow,
} from '../floating-window-stack';

interface AssetFolderFormState {
  mode: 'create' | 'edit';
  folderId: string | null;
  name: string;
  parentFolderId: string | null;
  color: string;
}

@Component({
  selector: 'app-asset-browser-modal',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, ColorPickerComponent],
  templateUrl: './asset-browser-modal.component.html',
})
export class AssetBrowserModalComponent {
  readonly userAssetsStore = inject(UserAssetsStore);
  private readonly notifications = inject(NotificationStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly windowId = allocateFloatingWindowId();

  readonly open = input<boolean>(false);
  readonly floating = input<boolean>(false);
  readonly mode = input<'picker' | 'manage'>('picker');
  readonly purpose = input<UserAssetPurpose>('maps');
  readonly initialFolderId = input<string | null | undefined>(undefined);
  readonly currentUrl = input<string | null>(null);
  readonly openRoutingOnInit = input<boolean>(false);

  readonly closed = output<void>();
  readonly assetSelected = output<UserAssetModel>();

  readonly folderSwatches = FOLDER_COLOR_SWATCHES;
  readonly formatBytes = formatAssetByteSize;

  readonly activeFolderId = signal<string | null>(null);
  readonly viewAllFolders = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly selectedAssetId = signal<string | null>(null);
  readonly editingAssetName = signal<string>('');
  readonly showRoutingSetup = signal<boolean>(false);
  readonly folderForm = signal<AssetFolderFormState | null>(null);
  readonly collapsedFolderIds = signal<Set<string>>(new Set());
  readonly draggingAssetId = signal<string | null>(null);
  readonly dragOverFolderTarget = signal<string | null>(null);
  readonly isExternalFileDragOver = signal<boolean>(false);

  readonly minimized = signal<boolean>(false);
  readonly windowX = signal<number>(96);
  readonly windowY = signal<number>(64);
  readonly isDraggingWindow = signal<boolean>(false);
  readonly zIndex = computed(() => computeFloatingWindowZIndex(this.windowId));

  private dragPointerOffsetX = 0;
  private dragPointerOffsetY = 0;
  private wasOpen = false;
  private positionedOnce = false;

  readonly modalTitle = computed<string>(() => {
    if (this.mode() === 'manage') return 'Personal Asset Library';
    if (this.purpose() === 'maps') return 'Select Scene Image';
    if (this.purpose() === 'characters') return 'Select Character Image';
    return 'Select Image';
  });

  readonly breadcrumbs = computed(() =>
    this.userAssetsStore.getBreadcrumbs(this.activeFolderId())
  );

  readonly activeStoragePath = computed(() =>
    this.userAssetsStore.getSupabaseFolderPath(this.activeFolderId())
  );

  readonly childSubfolders = computed(() => {
    if (this.viewAllFolders() || this.searchQuery().trim()) return [];
    const parentId = this.activeFolderId();
    return this.userAssetsStore
      .folders()
      .filter((f) => (f.parent_folder_id ?? null) === parentId)
      .slice()
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });
  });

  readonly visibleAssets = computed<UserAssetModel[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const all = this.userAssetsStore.assets();
    if (q) {
      return all.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (this.viewAllFolders()) {
      return all;
    }
    const folderId = this.activeFolderId();
    return all.filter((a) => (a.folder_id ?? null) === folderId);
  });

  readonly rootAssetCount = computed<number>(
    () =>
      this.userAssetsStore.assets().filter((a) => !a.folder_id).length
  );

  readonly selectedAsset = computed<UserAssetModel | null>(() => {
    const id = this.selectedAssetId();
    if (!id) return null;
    return this.userAssetsStore.assets().find((a) => a.id === id) ?? null;
  });

  readonly validParentFolderOptions = computed<DirectoryFolderOption[]>(() => {
    const form = this.folderForm();
    const allOpts = this.userAssetsStore.directoryTree().flatFolderOptions;
    if (!form) return allOpts;

    const editingId = form.mode === 'edit' ? form.folderId : null;
    const blocked = editingId
      ? collectDescendantFolderIds(
          editingId,
          this.userAssetsStore.projectedFolders()
        )
      : new Set<string>();
    if (editingId) blocked.add(editingId);

    return allOpts.filter(
      (opt) =>
        !blocked.has(opt.id) &&
        this.userAssetsStore.canNestFolder(editingId, opt.id)
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      releaseFloatingWindow(this.windowId);
    });

    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        untracked(() => {
          this.minimized.set(false);
          if (this.floating()) {
            if (!this.positionedOnce) {
              this.positionedOnce = true;
              const coords = computeInitialFloatingWindowCoords(960, 720);
              this.windowX.set(coords.x);
              this.windowY.set(coords.y);
            } else {
              const clamped = clampFloatingWindowCoords(
                this.windowX(),
                this.windowY()
              );
              this.windowX.set(clamped.x);
              this.windowY.set(clamped.y);
            }
            focusFloatingWindow(this.windowId);
          }
          void this.initializeOnOpen();
        });
      } else if (!isOpen && this.wasOpen) {
        this.wasOpen = false;
        untracked(() => {
          this.isDraggingWindow.set(false);
          releaseFloatingWindow(this.windowId);
        });
      }
    });
  }

  focusWindow(): void {
    if (this.floating()) {
      focusFloatingWindow(this.windowId);
    }
  }

  toggleMinimize(): void {
    this.minimized.update((v) => !v);
  }

  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onHeaderPointerDown(event: PointerEvent): void {
    if (!this.floating()) return;
    this.focusWindow();
    if (event.button !== 0) return;
    const el = event.target as HTMLElement | null;
    if (el?.closest('button, input, select, textarea, a, label, kbd')) {
      return;
    }
    event.preventDefault();
    this.isDraggingWindow.set(true);
    this.dragPointerOffsetX = event.clientX - this.windowX();
    this.dragPointerOffsetY = event.clientY - this.windowY();
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.isDraggingWindow()) return;
    const clamped = clampFloatingWindowCoords(
      event.clientX - this.dragPointerOffsetX,
      event.clientY - this.dragPointerOffsetY
    );
    this.windowX.set(clamped.x);
    this.windowY.set(clamped.y);
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
    }
  }

  @HostListener('window:pointercancel')
  onWindowPointerCancel(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.floating() || !this.open()) return;
    const clamped = clampFloatingWindowCoords(this.windowX(), this.windowY());
    if (clamped.x !== this.windowX()) {
      this.windowX.set(clamped.x);
    }
    if (clamped.y !== this.windowY()) {
      this.windowY.set(clamped.y);
    }
  }

  private async initializeOnOpen(): Promise<void> {
    this.searchQuery.set('');
    this.folderForm.set(null);
    this.showRoutingSetup.set(this.openRoutingOnInit());
    await this.userAssetsStore.ensureLoaded();

    const explicitFolder = this.initialFolderId();
    const matched = this.userAssetsStore.findAssetByUrl(this.currentUrl());

    if (explicitFolder !== undefined) {
      this.viewAllFolders.set(false);
      this.activeFolderId.set(explicitFolder);
    } else if (matched) {
      this.viewAllFolders.set(false);
      this.activeFolderId.set(matched.folder_id ?? null);
    } else {
      this.viewAllFolders.set(false);
      this.activeFolderId.set(
        this.userAssetsStore.resolveTargetFolderId(this.purpose())
      );
    }

    if (matched) {
      this.selectAssetCard(matched);
    } else {
      this.selectedAssetId.set(null);
      this.editingAssetName.set('');
    }
  }

  close(): void {
    this.folderForm.set(null);
    this.draggingAssetId.set(null);
    this.dragOverFolderTarget.set(null);
    this.isExternalFileDragOver.set(false);
    this.closed.emit();
  }

  navigateToFolder(folderId: string | null): void {
    this.viewAllFolders.set(false);
    this.searchQuery.set('');
    this.activeFolderId.set(folderId);
  }

  showAllAssets(): void {
    this.viewAllFolders.set(true);
    this.searchQuery.set('');
  }

  toggleFolderCollapse(folderId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.collapsedFolderIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  isFolderCollapsed(folderId: string): boolean {
    return this.collapsedFolderIds().has(folderId);
  }

  selectAssetCard(asset: UserAssetModel): void {
    this.selectedAssetId.set(asset.id);
    this.editingAssetName.set(asset.name);
  }

  confirmSelectAsset(asset: UserAssetModel): void {
    this.selectAssetCard(asset);
    if (this.mode() === 'picker') {
      this.assetSelected.emit(asset);
      this.close();
    }
  }

  confirmSelectedFooter(): void {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.assetSelected.emit(asset);
    this.close();
  }

  openCreateFolderForm(
    parentFolderId: string | null = null,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();
    const safeParent = this.userAssetsStore.canNestFolder(null, parentFolderId)
      ? parentFolderId
      : null;
    this.folderForm.set({
      mode: 'create',
      folderId: null,
      name: '',
      parentFolderId: safeParent,
      color: '#C4491A',
    });
  }

  openEditFolderForm(folderId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const existing = this.userAssetsStore
      .folders()
      .find((f) => f.id === folderId);
    if (!existing) return;
    this.folderForm.set({
      mode: 'edit',
      folderId: existing.id,
      name: existing.name,
      parentFolderId: existing.parent_folder_id,
      color: existing.color || '#C4491A',
    });
  }

  updateFolderFormField<K extends keyof AssetFolderFormState>(
    key: K,
    value: AssetFolderFormState[K]
  ): void {
    const cur = this.folderForm();
    if (!cur) return;
    this.folderForm.set({ ...cur, [key]: value });
  }

  async submitFolderForm(): Promise<void> {
    const form = this.folderForm();
    if (!form || !form.name.trim()) return;

    if (form.mode === 'create') {
      const created = await this.userAssetsStore.createFolder(
        form.name,
        form.parentFolderId,
        form.color
      );
      this.folderForm.set(null);
      if (created) {
        this.viewAllFolders.set(false);
        this.activeFolderId.set(created.id);
      }
      return;
    }

    if (form.folderId) {
      await this.userAssetsStore.updateFolder(form.folderId, {
        name: form.name,
        parent_folder_id: form.parentFolderId,
        color: form.color,
      });
      this.folderForm.set(null);
    }
  }

  async deleteFolderById(folderId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const target = this.userAssetsStore
      .folders()
      .find((f) => f.id === folderId);
    if (!target) return;
    if (this.activeFolderId() === folderId) {
      this.activeFolderId.set(target.parent_folder_id ?? null);
    }
    if (this.folderForm()?.folderId === folderId) {
      this.folderForm.set(null);
    }
    await this.userAssetsStore.deleteFolder(folderId);
  }

  async onUploadFilesInput(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []);
    inputEl.value = '';
    await this.uploadFilesBatch(files);
  }

  private async uploadFilesBatch(files: File[]): Promise<void> {
    if (files.length === 0) return;
    const targetFolder = this.viewAllFolders()
      ? this.userAssetsStore.resolveTargetFolderId(this.purpose())
      : this.activeFolderId();

    let lastUploaded: UserAssetModel | null = null;
    for (const file of files) {
      const uploaded = await this.userAssetsStore.uploadAssetFile(file, {
        folderId: targetFolder,
        purpose: this.purpose(),
        silent: files.length > 1,
      });
      if (uploaded) {
        lastUploaded = uploaded;
      }
    }

    if (files.length > 1 && lastUploaded) {
      this.notifications.success(
        'Assets Uploaded',
        `Uploaded ${files.length} images to ${this.userAssetsStore.getFolderTrailLabel(targetFolder)}.`
      );
    }

    if (lastUploaded) {
      if (this.viewAllFolders()) {
        this.viewAllFolders.set(false);
        this.activeFolderId.set(targetFolder);
      }
      this.selectAssetCard(lastUploaded);
    }
  }

  async saveSelectedAssetRename(): Promise<void> {
    const asset = this.selectedAsset();
    const trimmed = this.editingAssetName().trim();
    if (!asset || !trimmed || trimmed === asset.name) return;
    await this.userAssetsStore.renameAsset(asset.id, trimmed);
  }

  async moveSelectedAsset(folderId: string | null): Promise<void> {
    const asset = this.selectedAsset();
    if (!asset) return;
    await this.userAssetsStore.moveAssetToFolder(asset.id, folderId);
  }

  async deleteSelectedAsset(): Promise<void> {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.selectedAssetId.set(null);
    this.editingAssetName.set('');
    await this.userAssetsStore.deleteAsset(asset.id);
  }

  async copySelectedAssetUrl(): Promise<void> {
    const asset = this.selectedAsset();
    if (!asset) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(asset.public_url);
      }
      this.notifications.success(
        'Copied Image URL',
        `${asset.name} link copied to clipboard.`
      );
    } catch {
      this.notifications.info('Image URL', asset.public_url);
    }
  }

  getFolderBadgeForAsset(asset: UserAssetModel): string {
    if (!asset.folder_id) return 'Root';
    const found = this.userAssetsStore
      .folders()
      .find((f) => f.id === asset.folder_id);
    return found?.name ?? 'Root';
  }

  onAssetDragStart(event: DragEvent, asset: UserAssetModel): void {
    this.draggingAssetId.set(asset.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', asset.id);
    }
  }

  onAssetDragEnd(): void {
    this.draggingAssetId.set(null);
    this.dragOverFolderTarget.set(null);
  }

  onFolderDropTargetDragOver(
    event: DragEvent,
    targetKey: string
  ): void {
    if (!this.draggingAssetId()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolderTarget.set(targetKey);
  }

  async onFolderDropTargetDrop(
    event: DragEvent,
    folderId: string | null
  ): Promise<void> {
    const assetId = this.draggingAssetId();
    if (!assetId) return;
    event.preventDefault();
    event.stopPropagation();
    this.draggingAssetId.set(null);
    this.dragOverFolderTarget.set(null);
    await this.userAssetsStore.moveAssetToFolder(assetId, folderId);
  }

  onBrowserPaneDragOver(event: DragEvent): void {
    if (this.draggingAssetId()) return;
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
      this.isExternalFileDragOver.set(true);
    }
  }

  onBrowserPaneDragLeave(): void {
    this.isExternalFileDragOver.set(false);
  }

  async onBrowserPaneDrop(event: DragEvent): Promise<void> {
    this.isExternalFileDragOver.set(false);
    if (this.draggingAssetId()) return;
    const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;
    event.preventDefault();
    await this.uploadFilesBatch(files);
  }
}
