import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { setupI18n } from '../../test/renderWithProviders';
import StaleDataProvider, { useStaleData } from '../StaleDataContext';
import StaleDataNotice from '../../components/StaleDataNotice';

/** Marks the screen as serving cache, the way the request layer does. */
const Marker: React.FC<{ fetchedAt: string; label?: string }> = ({ fetchedAt, label }) => {
  const { noteCached } = useStaleData();
  return (
    <button type="button" onClick={() => noteCached(fetchedAt)}>
      {label ?? 'mark'}
    </button>
  );
};

const Elsewhere: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/next')}>
      go
    </button>
  );
};

/*
 * The package's own i18n harness, not the app's config: the latter loads
 * catalogues asynchronously and suspends, which renders nothing at all here.
 */
const renderAt = (ui: React.ReactNode) =>
  render(
    <I18nextProvider i18n={setupI18n()}>
      <MemoryRouter initialEntries={['/']}>
        <StaleDataProvider>
          <StaleDataNotice />
          <Routes>
            <Route path="/" element={<>{ui}</>} />
            <Route path="/next" element={<div>next screen</div>} />
          </Routes>
        </StaleDataProvider>
      </MemoryRouter>
    </I18nextProvider>
  );

const press = (name: string) => act(() => screen.getByRole('button', { name }).click());

/**
 * The rule this exists for: a cached screen must say so.
 *
 * Stale data presented as current is worse than no data — a member reading a
 * three-hour-old entry list as live turns up to an event that filled. Once the
 * offline banner is collapsed to a chip, nothing else distinguishes saved data
 * from fresh.
 */
describe('StaleDataNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T14:00:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('says nothing while everything on the screen is fresh', () => {
    renderAt(<Marker fetchedAt="2026-08-12T09:14:00" />);

    expect(screen.queryByText(/was saved/i)).not.toBeInTheDocument();
  });

  it('says when the data was saved, once something is served from cache', () => {
    renderAt(<Marker fetchedAt="2026-08-12T09:14:00" />);

    press('mark');

    expect(screen.getByText(/Some of this was saved at/)).toBeInTheDocument();
    expect(screen.getByText(/09:14/)).toBeInTheDocument();
  });

  /** "Saved at 09:14" is unambiguous this morning and misleading tomorrow. */
  it('includes the date when the data is not from today', () => {
    renderAt(<Marker fetchedAt="2026-08-10T09:14:00" />);

    press('mark');

    expect(screen.getByText(/Some of this was saved on/)).toBeInTheDocument();
    expect(screen.getByText(/10 Aug/)).toBeInTheDocument();
  });

  /**
   * A screen makes several requests. If one list is fresh and another is
   * saved, part of what the member is reading is old — and the oldest is the
   * weakest thing the screen stands on.
   */
  it('reports the oldest of several cached answers', () => {
    renderAt(
      <>
        <Marker fetchedAt="2026-08-12T11:00:00" label="recent" />
        <Marker fetchedAt="2026-08-12T08:30:00" label="older" />
      </>
    );

    press('recent');
    press('older');

    expect(screen.getByText(/08:30/)).toBeInTheDocument();
  });

  it('is not pushed later by a newer cached answer arriving second', () => {
    renderAt(
      <>
        <Marker fetchedAt="2026-08-12T08:30:00" label="older" />
        <Marker fetchedAt="2026-08-12T11:00:00" label="recent" />
      </>
    );

    press('older');
    press('recent');

    expect(screen.getByText(/08:30/)).toBeInTheDocument();
  });

  /** The claim is about the screen in front of the member, not the session. */
  it('clears on navigation, so a fresh page does not wear a stale label', () => {
    renderAt(
      <>
        <Marker fetchedAt="2026-08-12T09:14:00" />
        <Elsewhere />
      </>
    );
    press('mark');
    expect(screen.getByText(/was saved at/i)).toBeInTheDocument();

    press('go');

    expect(screen.getByText('next screen')).toBeInTheDocument();
    expect(screen.queryByText(/was saved/i)).not.toBeInTheDocument();
  });

  it('ignores a timestamp it cannot read rather than showing "Invalid Date"', () => {
    renderAt(<Marker fetchedAt="not a date" />);

    press('mark');

    expect(screen.queryByText(/was saved/i)).not.toBeInTheDocument();
  });

  /** The public screens render outside the shell, with no provider above them. */
  it('does nothing at all with no provider', () => {
    render(
      <I18nextProvider i18n={setupI18n()}>
        <MemoryRouter>
          <StaleDataNotice />
        </MemoryRouter>
      </I18nextProvider>
    );

    expect(screen.queryByText(/was saved/i)).not.toBeInTheDocument();
  });
});
