import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnsavedChanges } from '../useUnsavedChanges';

describe('useUnsavedChanges', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets a clean form leave immediately', () => {
    const { result } = renderHook(() => useUnsavedChanges(false));
    const action = vi.fn();

    act(() => result.current.guard(action));

    expect(action).toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(false);
  });

  it('holds a dirty form and asks first', () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const action = vi.fn();

    act(() => result.current.guard(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(true);
  });

  it('runs the held action once the operator confirms', () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const action = vi.fn();

    act(() => result.current.guard(action));
    act(() => result.current.confirmDiscard());

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.promptOpen).toBe(false);
  });

  it('drops the held action when the operator keeps editing', () => {
    const { result } = renderHook(() => useUnsavedChanges(true));
    const action = vi.fn();

    act(() => result.current.guard(action));
    act(() => result.current.cancelDiscard());

    expect(action).not.toHaveBeenCalled();
    expect(result.current.promptOpen).toBe(false);

    // And the abandoned action must not fire on a later, unrelated confirm.
    act(() => result.current.confirmDiscard());
    expect(action).not.toHaveBeenCalled();
  });

  it('registers a beforeunload guard only while dirty', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty), {
      initialProps: { dirty: false },
    });
    expect(add).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ dirty: true });
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ dirty: false });
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
  });
});
