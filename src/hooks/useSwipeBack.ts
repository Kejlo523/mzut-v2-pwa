import type React from 'react';
import { useCallback, useRef } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
}

interface UseSwipeOptions {
  canGoBack: boolean;
  onBack: () => void;
  canOpenDrawer: boolean;
  onOpenDrawer: () => void;
}

const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  const node = el as Element;
  if (INTERACTIVE_TAGS.has(node.tagName)) return true;
  if (node.getAttribute('role') === 'button') return true;
  return false;
}

export function useSwipeGestures({ canGoBack, onBack, canOpenDrawer, onOpenDrawer }: UseSwipeOptions): SwipeHandlers {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isFromEdge = useRef(false);
  const blocked = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;

    if (isInteractiveTarget(e.target)) {
      blocked.current = true;
      return;
    }

    blocked.current = false;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    // 44px edge zone for drawer open
    isFromEdge.current = e.touches[0].clientX <= 44;
  }, []);

  const onTouchMove = useCallback((_e: React.TouchEvent<HTMLElement>) => {
    // nothing — we decide on touchEnd
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (blocked.current) { blocked.current = false; return; }
    if (startX.current === null || startY.current === null) return;

    const origX = startX.current;
    const dx = e.changedTouches[0].clientX - origX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current);
    startX.current = null;
    startY.current = null;

    // Reject if mostly vertical
    if (dy > Math.abs(dx) * 0.8) return;

    // Swipe right from left edge → open drawer
    if (isFromEdge.current && dx > 50 && dy < 70 && canOpenDrawer) {
      onOpenDrawer();
      return;
    }

    // Swipe right (back) from very left edge
    if (dx > 80 && dy < 70 && origX <= 44 && canGoBack) {
      onBack();
    }
  }, [canGoBack, onBack, canOpenDrawer, onOpenDrawer]);

  const onTouchCancel = useCallback(() => {
    startX.current = null;
    startY.current = null;
    blocked.current = false;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}

// Legacy compat
export function useSwipeBack(enabled: boolean, onBack: () => void) {
  return useSwipeGestures({
    canGoBack: enabled,
    onBack,
    canOpenDrawer: false,
    onOpenDrawer: () => { },
  });
}
