import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RichText } from '../RichText';

/**
 * Rendering club-authored HTML.
 *
 * Terms and conditions are written in an org-admin rich-text editor and stored
 * as HTML. Rendered as text they show the member the tags; rendered raw they
 * hand whoever wrote them script execution in every reader's browser. The
 * sanitising is the whole point of the component, so it is what these assert.
 */
describe('RichText', () => {
  it('renders formatting rather than showing the tags', () => {
    const { container } = render(<RichText html="<p>this is a <strong>test</strong></p>" />);

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(container.querySelector('strong')).not.toBeNull();
    // The member must never see the markup itself.
    expect(container.textContent).not.toContain('<p>');
  });

  it('keeps lists and links, which terms are usually made of', () => {
    const { container } = render(
      <RichText html='<ul><li>One</li></ul><a href="https://example.test">Read more</a>' />
    );

    expect(container.querySelector('li')?.textContent).toBe('One');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.test');
  });

  describe('sanitising', () => {
    it('strips script tags', () => {
      const { container } = render(
        <RichText html='<p>Terms</p><script>window.stolen = document.cookie</script>' />
      );

      expect(container.querySelector('script')).toBeNull();
      expect(screen.getByText('Terms')).toBeInTheDocument();
    });

    it('strips inline event handlers', () => {
      const { container } = render(<RichText html='<p onclick="alert(1)">Terms</p>' />);

      expect(container.querySelector('p')?.getAttribute('onclick')).toBeNull();
    });

    it('strips javascript: links', () => {
      const { container } = render(
        // eslint-disable-next-line no-script-url
        <RichText html='<a href="javascript:alert(1)">Click</a>' />
      );

      // DOMPurify drops the attribute outright rather than rewriting it, so the
      // link survives as text with nowhere to go.
      const href = container.querySelector('a')?.getAttribute('href');
      expect(href ?? '').not.toContain('javascript:');
    });

    /**
     * Not merely unsafe — a club should not be able to turn terms members are
     * legally agreeing to into a page that loads anything from elsewhere.
     */
    it.each(['img', 'iframe', 'object'])('strips %s elements', (tag) => {
      const { container } = render(
        <RichText html={`<p>Terms</p><${tag} src="https://tracker.test/x"></${tag}>`} />
      );

      expect(container.querySelector(tag)).toBeNull();
      expect(screen.getByText('Terms')).toBeInTheDocument();
    });
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
  ])('renders nothing for %s', (_label, value) => {
    const { container } = render(<RichText html={value as string | null | undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
