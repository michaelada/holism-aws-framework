/**
 * `t` must keep its identity between renders.
 *
 * This is a test about a dependency array, which is an odd thing to test until
 * you have watched what happens without it. The wrapper built a new `t` closure
 * on every render. A page then wrote the obvious thing:
 *
 *     const load = useCallback(async () => { … }, [execute, t]);
 *     useEffect(() => { void load(); }, [load]);
 *
 * — and looped. Render produced a new `t`, which produced a new `load`, which
 * re-fired the effect, which set state, which rendered. The offline payments
 * list issued requests until the API returned HTTP 429 and the browser gave up
 * with ERR_INSUFFICIENT_RESOURCES. Nothing on screen suggested a loop; the page
 * simply sat on its spinner.
 *
 * No test of any single page would have caught it, because every page's own
 * code was correct. The defect lived one level down, in something every module
 * calls. So it is asserted here, once, for all of them.
 *
 * The language change is asserted too: stability that never invalidates would
 * be its own bug, freezing the interface in the language it first rendered.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTranslation } from '../useTranslation';

/**
 * A stand-in for react-i18next that reproduces the property that matters: its
 * own `t` is snapshot-cached, changing only when the language does. The wrapper
 * must not degrade that.
 */
const state = { language: 'en-GB' };
const tFor = new Map<string, (key: string) => string>();
const changeLanguage = vi.fn(async (lng: string) => {
  state.language = lng;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    if (!tFor.has(state.language)) {
      tFor.set(state.language, (key: string) => `${state.language}:${key}`);
    }
    return {
      t: tFor.get(state.language)!,
      i18n: { language: state.language, changeLanguage },
      ready: true,
    };
  },
}));

beforeEach(() => {
  state.language = 'en-GB';
  tFor.clear();
  changeLanguage.mockClear();
});

describe('useTranslation returns stable references', () => {
  it('hands back the same `t` across re-renders', () => {
    const { result, rerender } = renderHook(() => useTranslation());
    const first = result.current.t;

    rerender();
    rerender();
    rerender();

    expect(result.current.t).toBe(first);
  });

  it('hands back the same result object across re-renders', () => {
    // Destructuring is the common case, but code that keeps the whole object —
    // or passes it down — must not churn either.
    const { result, rerender } = renderHook(() => useTranslation());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.i18n).toBe(first.i18n);
  });

  it('does not re-run an effect that depends on `t`', () => {
    /*
     * The failure as a user met it, in miniature: an effect keyed on a callback
     * keyed on `t`. Before the fix this ran once per render, without limit.
     */
    const effect = vi.fn();
    const { rerender } = renderHook(() => {
      const { t } = useTranslation();
      const load = React.useCallback(() => t('any.key'), [t]);
      React.useEffect(() => {
        effect();
      }, [load]);
    });

    rerender();
    rerender();
    rerender();

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('gives a new `t` when the language changes, so the interface follows it', async () => {
    const { result, rerender } = renderHook(() => useTranslation());
    const before = result.current.t;
    expect(before('common.save')).toBe('en-GB:common.save');

    await act(async () => {
      await result.current.i18n.changeLanguage('de-DE');
    });
    rerender();

    expect(result.current.t).not.toBe(before);
    expect(result.current.t('common.save')).toBe('de-DE:common.save');
    expect(result.current.i18n.language).toBe('de-DE');
  });

  it('still returns the key rather than throwing when translation blows up', () => {
    // The wrapper's original purpose, kept intact by the memoisation.
    tFor.set('en-GB', () => {
      throw new Error('resource bundle missing');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useTranslation());

    expect(result.current.t('some.key')).toBe('some.key');
    consoleError.mockRestore();
  });
});
