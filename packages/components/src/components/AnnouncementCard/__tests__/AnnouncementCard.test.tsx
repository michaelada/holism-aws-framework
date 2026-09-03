import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnnouncementCard, effectivePlacement } from '../AnnouncementCard';

/**
 * One club announcement, as a member sees it — and as the org-admin previews it.
 *
 * The same component does both, which is the point: a preview built separately
 * drifts from the thing it previews. What has to hold is that the three
 * placements are three different arrangements, and that a background image is
 * darkened *by the card* rather than by asking a club to prepare a dark
 * photograph.
 */

const announcement = (over: Record<string, unknown> = {}) => ({
  id: 'ann-1',
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  imageUrl: null,
  imagePlacement: null,
  ...over,
});

describe('AnnouncementCard', () => {
  it('shows the title and the words', () => {
    render(<AnnouncementCard announcement={announcement() as never} />);

    expect(screen.getByRole('heading', { name: 'Clubhouse closed Saturday' })).toBeInTheDocument();
    expect(screen.getByText('The floor is being replaced.')).toBeInTheDocument();
  });

  it('renders the description as formatting, not as tags', () => {
    // It is written in a rich-text editor and stored as HTML; showing the tags
    // would be showing the member the editor's plumbing.
    render(
      <AnnouncementCard
        announcement={announcement({ description: '<p>Places are <strong>open</strong>.</p>' }) as never}
      />
    );

    expect(screen.getByText('open').tagName).toBe('STRONG');
  });

  it('is an ordinary card when there is no image', () => {
    const { container } = render(<AnnouncementCard announcement={announcement() as never} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByTestId('announcement-scrim')).not.toBeInTheDocument();
  });

  it('puts a header image above the words', () => {
    const { container } = render(
      <AnnouncementCard
        announcement={
          announcement({ imageUrl: 'https://example.test/camp.jpg', imagePlacement: 'header' }) as never
        }
      />
    );

    const image = container.querySelector('img');
    const heading = screen.getByRole('heading');
    expect(image).not.toBeNull();
    // Above, in document order — which is what a screen reader follows too.
    expect(image!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts a footer image below the words', () => {
    const { container } = render(
      <AnnouncementCard
        announcement={
          announcement({ imageUrl: 'https://example.test/camp.jpg', imagePlacement: 'footer' }) as never
        }
      />
    );

    const image = container.querySelector('img');
    const heading = screen.getByRole('heading');
    expect(heading.compareDocumentPosition(image!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('darkens a background image rather than asking the club to', () => {
    /*
     * The requirement in the club's own words: *"if it is to be used as a
     * background it should be reasonably dark so the text can be seen"*. A club
     * uploads whatever photograph it has, so legibility has to be a property of
     * the card.
     */
    render(
      <AnnouncementCard
        announcement={
          announcement({
            imageUrl: 'https://example.test/clubhouse.jpg',
            imagePlacement: 'background',
          }) as never
        }
      />
    );

    const scrim = screen.getByTestId('announcement-scrim');
    expect(scrim).toBeInTheDocument();
    expect(scrim).toHaveStyle({ position: 'absolute' });
    // Decoration, not content: a screen reader has nothing to say about it.
    expect(scrim).toHaveAttribute('aria-hidden');
  });

  it('writes over a background in white, not in the body colour', () => {
    render(
      <AnnouncementCard
        announcement={
          announcement({
            imageUrl: 'https://example.test/clubhouse.jpg',
            imagePlacement: 'background',
          }) as never
        }
      />
    );

    expect(screen.getByRole('heading')).toHaveStyle({ color: '#FFFFFF' });
  });

  it('does not show a background image as a picture as well', () => {
    // It is the card's background; an `img` too would render it twice.
    const { container } = render(
      <AnnouncementCard
        announcement={
          announcement({
            imageUrl: 'https://example.test/clubhouse.jpg',
            imagePlacement: 'background',
          }) as never
        }
      />
    );

    expect(container.querySelector('img')).toBeNull();
  });
});

describe('the link', () => {
  it('is a button carrying the club’s own words', () => {
    render(
      <AnnouncementCard
        announcement={
          announcement({
            link: { label: 'Book a place', url: 'https://kildarehunt.test/camp' },
          }) as never
        }
      />
    );

    const link = screen.getByRole('link', { name: 'Book a place' });
    expect(link).toHaveAttribute('href', 'https://kildarehunt.test/camp');
  });

  it('opens in a new tab without handing over the old one', () => {
    /*
     * A member reading the home page is in the middle of their own business —
     * a basket half-filled — and `noopener` is what stops the opened page
     * reaching back into it.
     */
    render(
      <AnnouncementCard
        announcement={
          announcement({ link: { label: 'Book', url: 'https://kildarehunt.test' } }) as never
        }
      />
    );

    const link = screen.getByRole('link', { name: 'Book' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('shows nothing where the notice points nowhere', () => {
    render(<AnnouncementCard announcement={announcement() as never} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows nothing for half a link', () => {
    // A button with no destination does nothing; one with no words cannot be
    // read. The service refuses both, and the card renders neither.
    render(
      <AnnouncementCard
        announcement={announcement({ link: { label: 'Book', url: '' } }) as never}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('stays visible over a background photograph', () => {
    // The default outline disappears into whatever the picture happens to be.
    render(
      <AnnouncementCard
        announcement={
          announcement({
            imageUrl: 'https://example.test/clubhouse.jpg',
            imagePlacement: 'background',
            link: { label: 'Book', url: 'https://kildarehunt.test' },
          }) as never
        }
      />
    );

    expect(screen.getByRole('link', { name: 'Book' })).toHaveStyle({ color: '#FFFFFF' });
  });
});

describe('effectivePlacement', () => {
  it('is nothing where there is no image', () => {
    /*
     * A club that removes a picture but leaves the radio button on
     * "background" must not get a card that is a plain dark rectangle.
     */
    expect(
      effectivePlacement(announcement({ imagePlacement: 'background' }) as never)
    ).toBeNull();
  });

  it('is the club’s choice where there is one', () => {
    expect(
      effectivePlacement(
        announcement({ imageUrl: 'https://example.test/x.jpg', imagePlacement: 'footer' }) as never
      )
    ).toBe('footer');
  });
});
