import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostCard, PostCardPost } from '../PostCard';

/**
 * One platform announcement, as it appears beside a sign-in form.
 *
 * The order — image, title, message, links — is the design: a reader on a login
 * page is not there to read announcements, so a post has one chance to be
 * understood while being skimmed past.
 *
 * The links deserve the most care. They leave the platform, from a page where
 * somebody may have a half-typed password behind the tab.
 *
 * See docs/PLATFORM_POSTS.md.
 */

const post = (over: Partial<PostCardPost> = {}): PostCardPost => ({
  id: 'post-1',
  title: 'Planned maintenance',
  body: '<p>We will be unavailable on <strong>Sunday</strong>.</p>',
  imageUrl: null,
  links: [],
  ...over,
});

describe('what a post shows', () => {
  it('shows the title and the message', () => {
    render(<PostCard post={post()} />);

    expect(screen.getByText('Planned maintenance')).toBeInTheDocument();
    expect(screen.getByText(/We will be unavailable on/)).toBeInTheDocument();
  });

  it('keeps the formatting the author wrote', () => {
    render(<PostCard post={post()} />);

    expect(screen.getByText('Sunday').tagName).toBe('STRONG');
  });

  it('shows no image when there is none', () => {
    render(<PostCard post={post()} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('the image', () => {
  it('is prefixed with the API origin when the path is relative', () => {
    /*
     * The API returns a path, not an absolute URL, so an app served from a
     * different origin — which is every one of them in development — has to say
     * where the API is.
     */
    const { container } = render(
      <PostCard
        post={post({ imageUrl: '/api/public/posts/post-1/image' })}
        imageBaseUrl="http://localhost:3000"
      />
    );

    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'http://localhost:3000/api/public/posts/post-1/image'
    );
  });

  it('leaves an absolute URL alone', () => {
    const { container } = render(
      <PostCard
        post={post({ imageUrl: 'https://cdn.example.com/a.png' })}
        imageBaseUrl="http://localhost:3000"
      />
    );

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/a.png');
  });

  it('carries no alt text, deliberately', () => {
    /*
     * The title and body are in the same card, so a description here would be
     * read out twice — and an operator uploading a picture has nowhere to write
     * one. An empty alt marks it decorative, which is the truth.
     */
    const { container } = render(<PostCard post={post({ imageUrl: '/img.png' })} />);

    /*
     * Queried by tag rather than by role: an empty alt is exactly what keeps
     * the image out of the accessibility tree, so `getByRole` cannot see it —
     * which is the behaviour being asserted.
     */
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});

describe('links', () => {
  const withLinks = () =>
    post({
      links: [
        { label: 'Status page', url: 'https://status.example.com' },
        { label: 'Read more', url: 'https://example.com/notes' },
      ],
    });

  it('renders one button per link, in order', () => {
    render(<PostCard post={withLinks()} />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Status page', 'Read more']);
  });

  it('points each one at its own URL', () => {
    render(<PostCard post={withLinks()} />);

    expect(screen.getByRole('link', { name: 'Status page' })).toHaveAttribute(
      'href',
      'https://status.example.com'
    );
  });

  it('opens them in a new tab, without handing over the opener', () => {
    /*
     * Both halves matter. A reader may have a half-typed sign-in behind this
     * tab, and `noopener` is what stops the page they land on reaching back.
     */
    render(<PostCard post={withLinks()} />);

    const link = screen.getByRole('link', { name: 'Status page' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders nothing where a post has no links', () => {
    render(<PostCard post={post()} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('safety', () => {
  it('does not render a script smuggled into the body', () => {
    /*
     * The server sanitises this endpoint already; `RichText` sanitises again on
     * the way to the DOM. Belt and braces, because the body arrives as markup
     * and is written by a human into a rich-text editor.
     */
    render(
      <PostCard
        post={post({ body: '<p>Hello</p><script>window.__owned = true;</script>' })}
      />
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
});
