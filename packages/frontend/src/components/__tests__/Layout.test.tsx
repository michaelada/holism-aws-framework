import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout } from '../Layout';

/**
 * The shell every metadata screen sits inside.
 *
 * Its whole job is orientation: show where you are and let you go elsewhere.
 * The selected state is the part worth pinning — a rail that highlights nothing,
 * or highlights everything, loses the reader's place without breaking anything
 * a build would notice.
 */

const { navigate, location } = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: { current: { pathname: '/' } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useLocation: () => location.current,
}));

/**
 * Renders the shell and opens the navigation drawer.
 *
 * The rail is a *temporary* drawer, closed until the menu button is pressed —
 * so its items do not exist in the document until then, and a test that skips
 * the button is asserting about markup that has not been rendered.
 */
const renderLayout = ({ openDrawer = true } = {}) => {
  const result = render(
    <Layout>
      <div data-testid="page">Object definitions</div>
    </Layout>
  );
  if (openDrawer) fireEvent.click(screen.getByRole('button', { name: /menu/i }));
  return result;
};

const selectedItems = () =>
  Array.from(document.querySelectorAll('.Mui-selected')).map((el) => el.textContent?.trim());

beforeEach(() => {
  navigate.mockReset();
  location.current = { pathname: '/' };
});

describe('Layout', () => {
  it('renders the page it wraps', () => {
    renderLayout({ openDrawer: false });

    expect(screen.getByTestId('page')).toBeInTheDocument();
  });

  it('offers the three places there are to go', () => {
    renderLayout();

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Field Definitions')).toBeInTheDocument();
    expect(screen.getByText('Object Definitions')).toBeInTheDocument();
  });

  it('navigates to the item that was clicked', () => {
    renderLayout();

    fireEvent.click(screen.getByText('Field Definitions'));

    expect(navigate).toHaveBeenCalledWith('/fields');
  });

  it('marks exactly one item as the current place', () => {
    location.current = { pathname: '/objects' };

    renderLayout();

    // Two highlighted items is as disorienting as none.
    expect(selectedItems()).toEqual(['Object Definitions']);
  });

  it('moves the highlight when the route does', () => {
    location.current = { pathname: '/fields' };

    renderLayout();

    expect(selectedItems()).toEqual(['Field Definitions']);
  });

  it('highlights Home at the root, rather than nothing', () => {
    location.current = { pathname: '/' };

    renderLayout();

    expect(selectedItems()).toEqual(['Home']);
  });

  it('highlights nothing on a route the rail does not list, rather than guessing', () => {
    // `/objects/member/edit` is a real route with no rail entry of its own.
    // Highlighting the nearest match would claim the reader is somewhere they
    // are not; highlighting nothing is honest.
    location.current = { pathname: '/objects/member/edit' };

    renderLayout();

    expect(selectedItems()).toEqual([]);
  });
});
