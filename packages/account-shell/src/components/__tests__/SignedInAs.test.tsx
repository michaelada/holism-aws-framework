import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { SignedInAs, describeUser } from '../SignedInAs';
import { renderWithProviders } from '../../test/renderWithProviders';

describe('describeUser', () => {
  it('gives the name and the email together', () => {
    expect(
      describeUser({ email: 'sam@example.com', firstName: 'Sam', lastName: 'Rivers' })
    ).toBe('Sam Rivers (sam@example.com)');
  });

  /*
   * The email is what distinguishes an administrator account from the same
   * person's member account, so it is never dropped in favour of the name.
   */
  it('keeps the email even when the name is unambiguous', () => {
    expect(describeUser({ email: 'admin@kildarehunt.test', firstName: 'Kildare', lastName: 'Admin' }))
      .toContain('admin@kildarehunt.test');
  });

  it('falls back to the email alone when there is no name', () => {
    expect(describeUser({ email: 'sam@example.com' })).toBe('sam@example.com');
  });

  it('does not leave a stray space when only one name part is set', () => {
    expect(describeUser({ email: 'sam@example.com', firstName: 'Sam' })).toBe(
      'Sam (sam@example.com)'
    );
    expect(describeUser({ email: 'sam@example.com', lastName: 'Rivers' })).toBe(
      'Rivers (sam@example.com)'
    );
  });
});

describe('SignedInAs', () => {
  it('names the signed-in identity', () => {
    renderWithProviders(<SignedInAs />);

    expect(screen.getByText('Signed in as Sam Rivers (member@example.com)')).toBeInTheDocument();
  });

  /* Anonymous is a state these screens can never be in, but rendering
     "Signed in as undefined" would be worse than rendering nothing. */
  it('renders nothing without a user', () => {
    const { container } = renderWithProviders(<SignedInAs />, { auth: { user: null } });

    expect(container.textContent).toBe('');
  });
});
