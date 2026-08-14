import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Guards a form against losing work.
 *
 * Two escape routes exist and they need different mechanisms:
 *
 * 1. Leaving the tab (close, refresh, external link) — the browser's own
 *    `beforeunload` prompt is the only thing that can interrupt it.
 * 2. Leaving via an in-app control (a back arrow, a Cancel button) — this we
 *    own, so we intercept it and ask.
 *
 * There is deliberately no router-level blocker. `unstable_useBlocker` needs a
 * data router (`createBrowserRouter`), and this app mounts a plain
 * `BrowserRouter`; swapping the router wholesale to guard a form would be a far
 * larger change than the problem warrants. In-app exits are guarded at the
 * controls instead, which covers every intentional exit the forms offer.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [promptOpen, setPromptOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by some browsers; the message itself is never shown.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /**
   * Wraps an exit. Clean forms leave immediately; dirty ones raise the prompt
   * and only leave if the operator confirms.
   */
  const guard = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pendingAction.current = action;
      setPromptOpen(true);
    },
    [isDirty]
  );

  const confirmDiscard = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setPromptOpen(false);
    action?.();
  }, []);

  const cancelDiscard = useCallback(() => {
    pendingAction.current = null;
    setPromptOpen(false);
  }, []);

  return { guard, promptOpen, confirmDiscard, cancelDiscard };
}
