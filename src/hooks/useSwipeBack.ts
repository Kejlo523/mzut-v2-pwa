import type React from 'react';
import { useCallback, useRef } from 'react';

interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

interface UseSwipeOptions {
  canGoBack: boolean;
  onBack: () => void;
  canOpenDrawer: boolean;
  onOpenDrawer: () => void;
}

export function useSwipeGestures({ canGoBack, onBack, canOpenDrawer, onOpenDrawer }: UseSwipeOptions): SwipeHandlers {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isFromEdge = useRef(false);
  const moved = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch') return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    moved.current = false;
    // Track if gesture starts from left edge (first 30px) for drawer open
    isFromEdge.current = e.clientX <= 30;
  }, []);

  const onPointerMove = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    moved.current = true;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - startY.current);
    const sx = startX.current;
    startX.current = null;
    startY.current = null;

    // Reject if mostly vertical
    if (dy > dx * 0.9) return;

    // Swipe right from left edge → open drawer
    if (isFromEdge.current && dx > 60 && dy < 60 && canOpenDrawer && onOpenDrawer) {
      onOpenDrawer();
      return;
    }

    // Swipe right (back gesture) — works from anywhere within first ~25% of screen
    if (dx > 80 && dy < 70 && sx <= 36 && canGoBack) {
      onBack();
    }
  }, [canGoBack, onBack, canOpenDrawer, onOpenDrawer]);

  const onPointerCancel = useCallback(() => {
    startX.current = null;
    startY.current = null;
    moved.current = false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

// Legacy compat
export function useSwipeBack(enabled: boolean, onBack: () => void) {
  return useSwipeGestures({
    canGoBack: enabled,
    onBack,
    canOpenDrawer: false,
    onOpenDrawer: () => {},
  });
}
