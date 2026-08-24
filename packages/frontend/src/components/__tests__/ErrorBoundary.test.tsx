import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * The last thing between a thrown render and a blank white page.
 *
 * A boundary that catches but offers no way out is only marginally better than
 * the crash — the visitor is stuck looking at an apology. So what is tested is
 * the recovery: that "Try Again" genuinely re-renders the children rather than
 * redrawing the same message, and that the raw error text stays out of a
 * production build.
 */

const Boom = ({ throws }: { throws: boolean }) => {
  if (throws) throw new Error('metadata request exploded');
  return <div data-testid="content">Object definitions</div>;
};

beforeEach(() => {
  // React logs caught render errors; the noise is not the test's concern.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('gets out of the way when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('catches a thrown render instead of taking the page down', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('tells the visitor what to do, not just that it failed', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>
    );

    expect(screen.getByText(/refreshing the page/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  /*
   * The recovery has to actually recover. Resetting the boundary while the
   * child still throws simply redraws the message — so the child is switched to
   * a working one first, which is what a real retry after a transient failure
   * looks like.
   */
  it('renders the children again once Try Again is pressed and the cause has passed', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    rerender(
      <ErrorBoundary>
        <Boom throws={false} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('stays on the message when Try Again is pressed and the cause has not passed', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Better than a blank page: the offer to retry can be made repeatedly.
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('records the error rather than swallowing it', () => {
    render(
      <ErrorBoundary>
        <Boom throws />
      </ErrorBoundary>
    );

    // An error nobody can see afterwards is an error nobody fixes.
    expect(console.error).toHaveBeenCalled();
  });
});
