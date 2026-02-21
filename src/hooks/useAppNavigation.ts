import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ScreenEntry<TScreen extends string = string, TParams = unknown> {
  key: TScreen;
  params?: TParams;
  id: number;
}

const EXIT_EVENT = 'mzutv2-exit-attempt';

export function useAppNavigation<TScreen extends string>(initialScreen: TScreen) {
  const idRef = useRef(1);
  const [stack, setStack] = useState<ScreenEntry<TScreen>[]>([{ key: initialScreen, id: 1 }]);
  const stackRef = useRef(stack);

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  useEffect(() => {
    const marker = { mzutv2: true, ts: Date.now() };
    window.history.replaceState(marker, '', window.location.href);
    window.history.pushState(marker, '', window.location.href);

    const onPopState = () => {
      if (stackRef.current.length > 1) {
        setStack((prev) => prev.slice(0, -1));
        return;
      }

      window.dispatchEvent(new CustomEvent(EXIT_EVENT));
      window.history.pushState({ mzutv2: true, ts: Date.now() }, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const push = useCallback((key: TScreen, params?: unknown) => {
    idRef.current += 1;
    window.history.pushState({ mzutv2: true, ts: Date.now() }, '', window.location.href);
    setStack((prev) => [...prev, { key, params, id: idRef.current }]);
  }, []);

  const reset = useCallback((key: TScreen, params?: unknown) => {
    idRef.current += 1;
    setStack([{ key, params, id: idRef.current }]);
    window.history.replaceState({ mzutv2: true, ts: Date.now() }, '', window.location.href);
    window.history.pushState({ mzutv2: true, ts: Date.now() }, '', window.location.href);
  }, []);

  const goBack = useCallback(() => {
    if (stackRef.current.length > 1) {
      window.history.back();
    }
  }, []);

  const current = stack[stack.length - 1];

  return useMemo(() => ({
    stack,
    current,
    canGoBack: stack.length > 1,
    push,
    reset,
    goBack,
  }), [stack, current, push, reset, goBack]);
}

export function useExitAttemptToast(handler: () => void) {
  useEffect(() => {
    const listener = () => handler();
    window.addEventListener(EXIT_EVENT, listener);
    return () => window.removeEventListener(EXIT_EVENT, listener);
  }, [handler]);
}
