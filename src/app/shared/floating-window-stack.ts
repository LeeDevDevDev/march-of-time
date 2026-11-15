import { signal } from '@angular/core';

let nextFloatingWindowInstanceId = 1;
const floatingWindowOrder = signal<number[]>([]);

export function allocateFloatingWindowId(): number {
  return nextFloatingWindowInstanceId++;
}

export function focusFloatingWindow(windowId: number): void {
  floatingWindowOrder.update((order) => {
    if (order.length > 0 && order[order.length - 1] === windowId) {
      return order;
    }
    const filtered = order.filter((id) => id !== windowId);
    filtered.push(windowId);
    return filtered;
  });
}

export function releaseFloatingWindow(windowId: number): void {
  floatingWindowOrder.update((order) =>
    order.includes(windowId) ? order.filter((id) => id !== windowId) : order
  );
}

export function computeFloatingWindowZIndex(windowId: number): number {
  const idx = floatingWindowOrder().indexOf(windowId);
  return 40 + (idx >= 0 ? idx : 0);
}

export function clampFloatingWindowCoords(
  x: number,
  y: number
): { x: number; y: number } {
  const maxW =
    typeof window !== 'undefined'
      ? Math.max(8, window.innerWidth - 220)
      : 1200;
  const maxH =
    typeof window !== 'undefined'
      ? Math.max(8, window.innerHeight - 56)
      : 800;
  return {
    x: Math.min(maxW, Math.max(8, Math.round(x))),
    y: Math.min(maxH, Math.max(8, Math.round(y))),
  };
}

export function computeInitialFloatingWindowCoords(
  estimatedWidth: number,
  estimatedHeight: number,
  initialX?: number | null,
  initialY?: number | null
): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const effectiveW = Math.min(Math.max(240, estimatedWidth), Math.max(240, vw - 24));
  const effectiveH = Math.min(Math.max(180, estimatedHeight), Math.max(180, vh - 96));
  const rawX =
    initialX !== undefined && initialX !== null
      ? initialX
      : Math.max(12, Math.round((vw - effectiveW) / 2));
  const rawY =
    initialY !== undefined && initialY !== null
      ? initialY
      : Math.max(48, Math.min(112, Math.round((vh - effectiveH) / 2)));
  return clampFloatingWindowCoords(rawX, rawY);
}
