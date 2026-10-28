import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm Deletion';
  @Input() itemName = '';
  @Input() badge = '';
  @Input() message = 'Are you sure you want to permanently delete this entry?';
  @Input() warningNote = '';
  @Input() confirmLabel = 'Delete Permanently';
  @Input() showArchiveOption = false;
  @Input() isLoading = false;

  @Output() readonly confirm = new EventEmitter<void>();
  @Output() readonly archiveInstead = new EventEmitter<void>();
  @Output() readonly cancel = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.open && !this.isLoading) {
      this.cancel.emit();
    }
  }

  onBackdropClick(): void {
    if (!this.isLoading) {
      this.cancel.emit();
    }
  }
}
