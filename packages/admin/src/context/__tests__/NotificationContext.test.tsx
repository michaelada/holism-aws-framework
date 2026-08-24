import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NotificationProvider, useNotification } from '../NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';
import { ApiError, NetworkError } from '../../services/adminApi';

/**
 * How the super-admin UI tells an operator what happened.
 *
 * The distinction between a success and a failure is not cosmetic here. A
 * success is announced politely and clears itself; a failure interrupts, and
 * stays on screen until it is dismissed — six seconds is not long enough to
 * read a failure and act on it, and an operator who misses it believes a
 * destructive action succeeded.
 *
 * `useApiCall` is the other half: it is what every page uses to run a request,
 * and it decides which of those two an operator sees, and whether a failed
 * request can be retried at all.
 */

const Harness = ({ onReady }: { onReady: (api: ReturnType<typeof useNotification>) => void }) => {
  const api = useNotification();
  onReady(api);
  return null;
};

/** Render the provider and hand back its notification functions. */
const renderProvider = () => {
  let api!: ReturnType<typeof useNotification>;
  render(
    <NotificationProvider>
      <Harness onReady={(a) => (api = a)} />
    </NotificationProvider>
  );
  return api;
};

const ApiHarness = ({ onReady }: { onReady: (call: ReturnType<typeof useApiCall>) => void }) => {
  const call = useApiCall();
  onReady(call);
  return null;
};

const renderApiCall = () => {
  let call!: ReturnType<typeof useApiCall>;
  render(
    <NotificationProvider>
      <ApiHarness onReady={(c) => (call = c)} />
    </NotificationProvider>
  );
  return call;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationProvider — announcing what happened', () => {
  it('says nothing until something happens', () => {
    renderProvider();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a success politely, so it queues behind what is being read', async () => {
    const api = renderProvider();

    act(() => api.showSuccess('Organisation saved'));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Organisation saved');
  });

  it('interrupts for a failure', async () => {
    const api = renderProvider();

    act(() => api.showError('Could not save the organisation'));

    // `role="alert"` is what makes a screen reader break off and read this.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not save the organisation');
  });

  it('announces information politely too', async () => {
    const api = renderProvider();

    act(() => api.showInfo('Export started'));

    expect(await screen.findByRole('status')).toHaveTextContent('Export started');
  });

  it('replaces the previous message rather than stacking', async () => {
    const api = renderProvider();

    act(() => api.showSuccess('Saved'));
    await screen.findByRole('status');
    act(() => api.showError('Then it failed'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Then it failed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const api = renderProvider();
    act(() => api.showError('Could not save'));
    const alert = await screen.findByRole('alert');

    fireEvent.click(alert.querySelector('button')!);

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('refuses to be used outside its provider rather than failing silently', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Rendering nothing would leave a page whose every save is invisible.
    expect(() => render(<Harness onReady={() => {}} />)).toThrow(/NotificationProvider/);
  });
});

describe('useApiCall — running a request on an operator’s behalf', () => {
  it('hands back what the request returned', async () => {
    const call = renderApiCall();

    const result = await call(async () => ({ id: 'org-1' }));

    expect(result.data).toEqual({ id: 'org-1' });
    expect(result.error).toBeNull();
  });

  it('announces the success message it was given', async () => {
    const call = renderApiCall();

    await act(async () => {
      await call(async () => null, { successMessage: 'Organisation saved' });
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Organisation saved');
  });

  it('stays quiet on success when the caller asked it to', async () => {
    const call = renderApiCall();

    await act(async () => {
      await call(async () => null, { successMessage: 'Saved', showSuccess: false });
    });

    // Background refreshes should not interrupt with a toast each time.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the server’s own explanation of a refusal', async () => {
    const call = renderApiCall();

    await act(async () => {
      await call(async () => {
        throw new ApiError(409, 'IN_USE', 'Organisation still has members');
      });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Organisation still has members');
  });

  it('prefers the caller’s wording when one was supplied', async () => {
    const call = renderApiCall();

    await act(async () => {
      await call(
        async () => {
          throw new ApiError(500, 'X', 'Internal server error');
        },
        { errorMessage: 'Could not save the organisation' }
      );
    });

    // "Internal server error" tells an operator nothing about what to do next.
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the organisation');
  });

  it('offers a retry for a request that never landed', async () => {
    const call = renderApiCall();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('Unable to connect to server.'))
      .mockResolvedValueOnce({ id: 'org-1' });

    let result!: Awaited<ReturnType<typeof call>>;
    await act(async () => {
      result = await call(request);
    });

    expect(result.isNetworkError).toBe(true);
    expect(result.retry).toBeTypeOf('function');

    await act(async () => {
      result = await result.retry!();
    });

    // The same request runs again; a retry that re-ran nothing is a dead button.
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ id: 'org-1' });
  });

  it('offers no retry for a request the server refused', async () => {
    const call = renderApiCall();

    let result!: Awaited<ReturnType<typeof call>>;
    await act(async () => {
      result = await call(async () => {
        throw new ApiError(403, 'FORBIDDEN', 'Not permitted');
      });
    });

    // Repeating a 403 gets the same 403; offering it invites a pointless loop.
    expect(result.isNetworkError).toBe(false);
    expect(result.retry).toBeUndefined();
  });

  it('turns something that was never an Error into one', async () => {
    const call = renderApiCall();

    let result!: Awaited<ReturnType<typeof call>>;
    await act(async () => {
      result = await call(async () => {
        throw 'just a string';
      });
    });

    // Callers read `error.message`; a bare string there is `undefined`.
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('just a string');
  });

  it('stays quiet on failure when the caller handles it itself', async () => {
    const call = renderApiCall();

    await act(async () => {
      await call(
        async () => {
          throw new ApiError(404, 'NOT_FOUND', 'Gone');
        },
        { showError: false }
      );
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
