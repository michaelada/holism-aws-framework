import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

/**
 * The list of platform posts, in the order they appear on the login pages.
 *
 * Ordering is the substance of this screen, so it is what most of these tests
 * are about: the arrangement shown here *is* the arrangement readers get, and
 * a list that can be re-sorted by title would be showing something else.
 *
 * See docs/PLATFORM_POSTS.md.
 */

const mocks = vi.hoisted(() => ({
  getPosts: vi.fn(),
  deletePost: vi.fn(),
  reorderPosts: vi.fn(),
  navigate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../../services/postApi', () => ({
  getPosts: mocks.getPosts,
  deletePost: mocks.deletePost,
  reorderPosts: mocks.reorderPosts,
}));

vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({
    showSuccess: mocks.showSuccess,
    showError: mocks.showError,
    showInfo: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { PostsPage } from '../PostsPage';

const post = (over: Record<string, unknown> = {}) => ({
  id: 'post-1',
  title: 'Planned maintenance',
  body: '<p>Sunday.</p>',
  imageUrl: null,
  links: [],
  status: 'active',
  showOnAccountLogin: true,
  showOnOrgadminLogin: false,
  displayOrder: 0,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  ...over,
});

const three = () => [
  post({ id: 'a', title: 'First' }),
  post({ id: 'b', title: 'Second' }),
  post({ id: 'c', title: 'Third' }),
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <PostsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPosts.mockResolvedValue(three());
  mocks.reorderPosts.mockImplementation(async (ids: string[]) =>
    ids.map((id, index) => post({ id, title: { a: 'First', b: 'Second', c: 'Third' }[id], displayOrder: index }))
  );
});

describe('the list', () => {
  it('shows the posts in their arranged order', async () => {
    renderPage();

    await screen.findByText('First');
    const titles = screen.getAllByText(/^(First|Second|Third)$/).map((node) => node.textContent);
    expect(titles).toEqual(['First', 'Second', 'Third']);
  });

  it('says where each post appears, not only whether it is active', async () => {
    /*
     * "Active" alone does not answer the question an operator is asking, which
     * is whether anyone is actually seeing this.
     */
    mocks.getPosts.mockResolvedValue([post({ showOnAccountLogin: true, showOnOrgadminLogin: true })]);
    renderPage();

    expect(await screen.findByText('Account login')).toBeInTheDocument();
    expect(screen.getByText('Org admin login')).toBeInTheDocument();
  });

  it('warns about an active post that is shown nowhere', async () => {
    // A legitimate state, and a contradiction on its face — so it is said out
    // loud rather than left for the operator to notice.
    mocks.getPosts.mockResolvedValue([
      post({ status: 'active', showOnAccountLogin: false, showOnOrgadminLogin: false }),
    ]);
    renderPage();

    expect(await screen.findByText('Not shown')).toBeInTheDocument();
  });

  it('offers somewhere to start when there is nothing', async () => {
    mocks.getPosts.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No posts yet')).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded, rather than looking empty', async () => {
    // An empty list and a failed load look identical otherwise, and one of them
    // means the login pages may be showing something nobody can see here.
    mocks.getPosts.mockRejectedValue(new Error('nope'));
    renderPage();

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});

describe('arranging', () => {
  it('sends the whole new order, not just the post that moved', async () => {
    /*
     * The server rewrites every row from this list, so two people reordering at
     * once end with one of their arrangements rather than an interleaving.
     */
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Move "Second" up' }));

    await waitFor(() => expect(mocks.reorderPosts).toHaveBeenCalledWith(['b', 'a', 'c']));
  });

  it('moves a post down as well as up', async () => {
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Move "First" down' }));

    await waitFor(() => expect(mocks.reorderPosts).toHaveBeenCalledWith(['b', 'a', 'c']));
  });

  it('cannot move the first post up or the last one down', async () => {
    // The buttons are present rather than absent, so the row does not change
    // shape as it moves through the list.
    renderPage();
    await screen.findByText('First');

    expect(screen.getByRole('button', { name: 'Move "First" up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move "Third" down' })).toBeDisabled();
  });

  it('reloads from the server when saving the order fails', async () => {
    /*
     * The move was already drawn optimistically. Rather than guessing at an
     * undo, the server's answer is fetched again — it is the one that matters,
     * and a wrong guess leaves the screen disagreeing with it.
     */
    mocks.reorderPosts.mockRejectedValue(new Error('nope'));
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Move "Second" up' }));

    await waitFor(() => expect(mocks.showError).toHaveBeenCalled());
    expect(mocks.getPosts).toHaveBeenCalledTimes(2);
  });
});

describe('deleting', () => {
  it('asks first, and says what will happen', async () => {
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Delete "First"' }));

    expect(await screen.findByText('Delete this post?')).toBeInTheDocument();
    expect(screen.getByText(/removed from every login page/i)).toBeInTheDocument();
    expect(mocks.deletePost).not.toHaveBeenCalled();
  });

  it('deletes only once confirmed', async () => {
    mocks.deletePost.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Delete "First"' }));
    await screen.findByText('Delete this post?');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mocks.deletePost).toHaveBeenCalledWith('a'));
  });

  it('does nothing when the operator backs out', async () => {
    renderPage();
    await screen.findByText('First');

    await userEvent.click(screen.getByRole('button', { name: 'Delete "First"' }));
    await screen.findByText('Delete this post?');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mocks.deletePost).not.toHaveBeenCalled();
  });
});
