import { NgClass } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  allocateFloatingWindowId,
  clampFloatingWindowCoords,
  computeFloatingWindowZIndex,
  computeInitialFloatingWindowCoords,
  focusFloatingWindow,
  releaseFloatingWindow,
} from '../../../../shared/floating-window-stack';

@Component({
  selector: 'app-vtt-floating-window',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vtt-floating-window.component.html',
})
export class VttFloatingWindowComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly windowId = allocateFloatingWindowId();

  readonly windowTitle = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly widthClass = input<string>('w-[min(94vw,480px)]');
  readonly estimatedWidth = input<number>(480);
  readonly estimatedHeight = input<number>(420);
  readonly initialX = input<number | null>(null);
  readonly initialY = input<number | null>(null);
  readonly surfaceTheme = input<'dark' | 'adaptive'>('dark');
  readonly accentBorder = input<boolean>(false);
  readonly allowOverflow = input<boolean>(false);
  readonly minimizable = input<boolean>(true);
  readonly initialMinimized = input<boolean>(false);
  readonly compactHeader = input<boolean>(false);

  readonly closed = output<void>();
  readonly positionChange = output<{ x: number; y: number }>();
  readonly minimizedChange = output<boolean>();

  readonly minimized = signal(false);
  readonly windowX = signal(88);
  readonly windowY = signal(64);
  readonly isDraggingWindow = signal(false);
  readonly zIndex = computed(() => computeFloatingWindowZIndex(this.windowId));

  private dragPointerOffsetX = 0;
  private dragPointerOffsetY = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      releaseFloatingWindow(this.windowId);
    });
  }

  ngOnInit(): void {
    this.minimized.set(this.initialMinimized());
    const coords = computeInitialFloatingWindowCoords(
      this.estimatedWidth(),
      this.estimatedHeight(),
      this.initialX(),
      this.initialY()
    );
    this.windowX.set(coords.x);
    this.windowY.set(coords.y);
    focusFloatingWindow(this.windowId);
  }

  focusWindow(): void {
    focusFloatingWindow(this.windowId);
  }

  toggleMinimize(): void {
    const next = !this.minimized();
    this.minimized.set(next);
    this.minimizedChange.emit(next);
  }

  closeWindow(): void {
    this.positionChange.emit({ x: this.windowX(), y: this.windowY() });
    this.closed.emit();
  }

  onHeaderPointerDown(event: PointerEvent): void {
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
    this.positionChange.emit(clamped);
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
      this.positionChange.emit({ x: this.windowX(), y: this.windowY() });
    }
  }

  @HostListener('window:pointercancel')
  onWindowPointerCancel(): void {
    if (this.isDraggingWindow()) {
      this.isDraggingWindow.set(false);
      this.positionChange.emit({ x: this.windowX(), y: this.windowY() });
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const clamped = clampFloatingWindowCoords(this.windowX(), this.windowY());
    if (clamped.x !== this.windowX()) {
      this.windowX.set(clamped.x);
    }
    if (clamped.y !== this.windowY()) {
      this.windowY.set(clamped.y);
    }
  }
}
