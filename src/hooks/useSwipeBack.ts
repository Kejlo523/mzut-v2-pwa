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

const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL']);

function isInteractiveTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  // Only check the direct target and its immediate parent — not the whole tree
  let node: Element | null = el as Element;
  for (let i = 0; i < 3 && node; i++) {
    if (INTERACTIVE_TAGS.has(node.tagName)) return true;
    if (node.getAttribute('role') === 'button') return true;
    node = node.parentElement;
  }
  return false;
}

export function useSwipeGestures({ canGoBack, onBack, canOpenDrawer, onOpenDrawer }: UseSwipeOptions): SwipeHandlers {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isFromEdge = useRef(false);
  const blocked = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch') return;

    if (isInteractiveTarget(e.target)) {
      blocked.current = true;
      return;
    }

    blocked.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    // 44px edge zone for drawer open
    isFromEdge.current = e.clientX <= 44;
  }, []);

  const onPointerMove = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    // nothing — we decide on pointerUp
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (blocked.current) { blocked.current = false; return; }
    if (startX.current === null || startY.current === null) return;

    const origX = startX.current;
    const dx = e.clientX - origX;
    const dy = Math.abs(e.clientY - startY.current);
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

  const onPointerCancel = useCallback(() => {
    startX.current = null;
    startY.current = null;
    blocked.current = false;
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
