import type React from 'react';
import { useMemo, useRef } from 'react';

export function useSwipeBack(enabled: boolean, onBack: () => void) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  return useMemo(() => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType !== 'touch') return;
      if (event.clientX > 36) return;
      startX.current = event.clientX;
      startY.current = event.clientY;
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || startX.current === null || startY.current === null) return;
      const deltaX = event.clientX - startX.current;
      const deltaY = Math.abs(event.clientY - startY.current);
      startX.current = null;
      startY.current = null;

      if (deltaX > 86 && deltaY < 42) {
        onBack();
      }
    },
    onPointerCancel: () => {
      startX.current = null;
      startY.current = null;
    },
  }), [enabled, onBack]);
}
