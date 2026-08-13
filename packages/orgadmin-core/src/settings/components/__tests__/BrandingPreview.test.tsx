import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import BrandingPreview, { BrandingPreviewColours } from '../BrandingPreview';
import { renderWithProviders } from '../../../test/renderWithProviders';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB' },
  }),
}));

/**
 * The preview's job is to be *evidence*. Its predecessor hand-tinted three
 * buttons with `sx`, so every other control kept the org-admin's own palette
 * and an administrator changing colours saw almost nothing change — which is
 * indistinguishable from the feature being broken.
 *
 * These tests therefore assert that the chosen colours reach components nobody
 * tinted by hand, and that the sample covers the shapes a member actually
 * meets: a form, a table, a list, and the app bar their logo sits in.
 */
const colours = (over: Partial<BrandingPreviewColours> = {}): BrandingPreviewColours => ({
  logoUrl: '',
  primaryColor: '#8b0000',
  secondaryColor: '#006400',
  accentColor: '#ff9800',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  ...over,
});

/** MUI emits `rgb(...)`; the pickers speak hex. */
const rgb = (hex: string) => {
  const v = hex.replace('#', '');
  return `rgb(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)})`;
};

describe('BrandingPreview', () => {
  it('applies the primary colour to components nobody tinted by hand', () => {
    renderWithProviders(<BrandingPreview colours={colours()} />);

    // A contained button gets its colour from the theme, not from an sx prop.
    const button = screen.getByRole('button', { name: 'settings.branding.preview.primaryButton' });
    expect(getComputedStyle(button).backgroundColor).toBe(rgb('#8b0000'));
  });

  it('applies the secondary colour', () => {
    renderWithProviders(<BrandingPreview colours={colours()} />);

    const button = screen.getByRole('button', {
      name: 'settings.branding.preview.secondaryButton',
    });
    expect(getComputedStyle(button).backgroundColor).toBe(rgb('#006400'));
  });

  it('re-themes when a colour changes', () => {
    const { rerender } = renderWithProviders(<BrandingPreview colours={colours()} />);
    rerender(<BrandingPreview colours={colours({ primaryColor: '#0000ff' })} />);

    const button = screen.getByRole('button', { name: 'settings.branding.preview.primaryButton' });
    expect(getComputedStyle(button).backgroundColor).toBe(rgb('#0000ff'));
  });

  /**
   * A half-typed colour must not blank the preview. The hex field is a text
   * input, so `#8b0` and `#` are both states an administrator passes through
   * while typing.
   */
  it.each(['#', '#8b', 'not-a-colour', ''])(
    'falls back rather than breaking on the partial value %s',
    (partial) => {
      renderWithProviders(<BrandingPreview colours={colours({ primaryColor: partial })} />);

      const button = screen.getByRole('button', {
        name: 'settings.branding.preview.primaryButton',
      });
      // The MUI default, not a crash and not a transparent button.
      expect(getComputedStyle(button).backgroundColor).toBe(rgb('#1976d2'));
    }
  );

  /**
   * Text on a brand colour has to stay legible, or the preview tells a club
   * their pale primary is fine when their members will see white on cream.
   */
  it('puts dark text on a light primary and light text on a dark one', () => {
    const { rerender } = renderWithProviders(
      <BrandingPreview colours={colours({ primaryColor: '#ffff00' })} />
    );
    let button = screen.getByRole('button', { name: 'settings.branding.preview.primaryButton' });
    expect(getComputedStyle(button).color).toBe('rgba(0, 0, 0, 0.87)');

    rerender(<BrandingPreview colours={colours({ primaryColor: '#000080' })} />);
    button = screen.getByRole('button', { name: 'settings.branding.preview.primaryButton' });
    expect(getComputedStyle(button).color).toBe('rgb(255, 255, 255)');
  });

  describe('what the sample covers', () => {
    it('shows the member app bar with the logo', () => {
      renderWithProviders(
        <BrandingPreview colours={colours({ logoUrl: 'https://example.test/logo.png' })} />
      );

      const logo = screen.getByRole('img');
      expect(logo).toHaveAttribute('src', 'https://example.test/logo.png');
    });

    /** With no logo, the organisation's initial stands in — as the real apps do. */
    it('falls back to an initial when there is no logo', () => {
      renderWithProviders(<BrandingPreview colours={colours()} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('includes form controls', () => {
      renderWithProviders(<BrandingPreview colours={colours()} />);

      expect(screen.getByLabelText('settings.branding.preview.fieldLabel')).toBeInTheDocument();
      // Two: the checkbox itself and the Switch, which MUI also exposes as one.
      expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      expect(screen.getAllByRole('radio')).toHaveLength(2);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('includes a table with a themed header', () => {
      renderWithProviders(<BrandingPreview colours={colours()} />);

      const table = screen.getByRole('table');
      expect(within(table).getByText('settings.branding.preview.tableItem')).toBeInTheDocument();
      expect(within(table).getByText('€45.00')).toBeInTheDocument();
    });

    it('includes a list', () => {
      renderWithProviders(<BrandingPreview colours={colours()} />);

      expect(screen.getByText('settings.branding.preview.listItemOne')).toBeInTheDocument();
      expect(screen.getByText('settings.branding.preview.listItemTwo')).toBeInTheDocument();
    });
  });
});
