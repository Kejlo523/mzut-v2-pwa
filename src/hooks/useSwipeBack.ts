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
  let node: Element | null = el as Element;
  // Walk up at most 6 levels to find an interactive ancestor
  for (let i = 0; i < 6 && node; i++) {
    if (INTERACTIVE_TAGS.has(node.tagName)) return true;
    if (node.getAttribute('role') === 'button') return true;
    // Elements with explicit non-negative tabIndex are usually interactive
    const ti = node.getAttribute('tabindex');
    if (ti !== null && ti !== '-1') return true;
    node = node.parentElement;
  }
  return false;
}

export function useSwipeGestures({ canGoBack, onBack, canOpenDrawer, onOpenDrawer }: UseSwipeOptions): SwipeHandlers {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isFromEdge = useRef(false);
  const blocked = useRef(false); // blocked because started on interactive element

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch') return;

    // Check if touch started on an interactive element — if so, don't track gesture
    if (isInteractiveTarget(e.target)) {
      blocked.current = true;
      return;
    }

    blocked.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    // Only track left-edge swipes for drawer (first 30px)
    isFromEdge.current = e.clientX <= 30;
  }, []);

  const onPointerMove = useCallback((_e: React.PointerEvent<HTMLElement>) => {
    // nothing to track here
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (blocked.current) { blocked.current = false; return; }
    if (startX.current === null || startY.current === null) return;

    const dx = e.clientX - startX.current;
    const dy = Math.abs(e.clientY - startY.current);
    startX.current = null;
    startY.current = null;

    // Reject if mostly vertical or not a meaningful swipe
    if (dy > Math.abs(dx) * 0.8) return;

    // Swipe right from left edge → open drawer
    if (isFromEdge.current && dx > 50 && dy < 60 && canOpenDrawer) {
      onOpenDrawer();
      return;
    }

    // Swipe right (back gesture) — from left 36px
    if (dx > 80 && dy < 70 && (startX.current ?? e.clientX) <= 36 && canGoBack) {
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
