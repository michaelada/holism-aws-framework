import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnnouncementEditorPage, { linkError, windowError } from '../AnnouncementEditorPage';

/**
 * Writing an announcement, beside the card a member will see.
 *
 * The preview is the reason this screen exists in the shape it does, and the
 * property that matters is that it is **the member's card**, not a drawing of
 * one: the same component the account application renders. A preview built
 * separately drifts, and what it gets wrong first is always what the preview
 * was for — how a long title wraps, how dark a photograph comes out.
 */

const { execute, navigate, params } = vi.hoisted(() => ({
  execute: vi.fn(),
  navigate: vi.fn(),
  params: { current: {} as Record<string, string> },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('@itsplainsailing/orgadmin-core', async () => ({
  useApi: () => ({ execute, data: null, error: null, loading: false, reset: vi.fn() }),
}));

vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return createShellMock();
});

/*
 * Quill needs a real range API that jsdom does not provide, and this suite is
 * about the surrounding screen rather than about a third-party editor. The stub
 * is a textarea, so typing a description still exercises the state the preview
 * reads.
 */
vi.mock('react-quill', () => ({
  default: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
    <textarea
      aria-label="Description"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock('react-quill/dist/quill.snow.css', () => ({}));

const saved = {
  id: 'ann-1',
  organisationId: 'org-1',
  title: 'Clubhouse closed Saturday',
  description: '<p>The floor is being replaced.</p>',
  startsAt: '2026-09-01T09:00:00.000Z',
  endsAt: '2026-09-06T18:00:00.000Z',
  imageUrl: null,
  imagePlacement: null,
  link: null,
  showing: true,
  createdAt: '2026-08-30T10:00:00.000Z',
  updatedAt: '2026-08-30T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  params.current = {};
  execute.mockResolvedValue(saved);
  // jsdom has no object URLs, and the editor makes one for a chosen image.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('a new announcement', () => {
  it('previews what is typed, as it is typed', async () => {
    render(<AnnouncementEditorPage />);

    await userEvent.type(screen.getByLabelText(/Title/), 'Clubhouse closed');

    // The preview is a heading, so this is the member's card rendering — not
    // an echo of the input's value.
    expect(
      await screen.findByRole('heading', { name: 'Clubhouse closed' })
    ).toBeInTheDocument();
  });

  it('shows a placeholder title rather than an empty card', async () => {
    render(<AnnouncementEditorPage />);

    expect(await screen.findByText('Untitled announcement')).toBeInTheDocument();
  });

  it('will not save without a title', async () => {
    render(<AnnouncementEditorPage />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('creates the announcement, then attaches the image', async () => {
    /*
     * Two steps, and the order matters: the S3 key is derived from the row's
     * id, so the row has to exist. A form that uploaded first would leave an
     * orphan object behind every time somebody changed their mind.
     */
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Clubhouse closed');

    const file = new File(['x'], 'clubhouse.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Image (optional)'), { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/announcements'));
    const [create, upload] = execute.mock.calls.map(([call]) => call);
    expect(create).toMatchObject({ method: 'POST', url: '/api/orgadmin/announcements' });
    expect(upload).toMatchObject({
      method: 'POST',
      url: '/api/orgadmin/announcements/ann-1/image',
    });
  });

  it('shows a chosen image straight away, before it is uploaded', async () => {
    // Choosing a picture should look like choosing a picture.
    render(<AnnouncementEditorPage />);

    const file = new File(['x'], 'clubhouse.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Image (optional)'), { target: { files: [file] } });

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(file));
    expect(await screen.findByRole('button', { name: 'Remove image' })).toBeInTheDocument();
  });

  it('does not offer a placement until there is an image', async () => {
    // A placement with no image renders as nothing.
    render(<AnnouncementEditorPage />);

    expect(screen.getByRole('radio', { name: 'Background' })).toBeDisabled();
  });

  it('tells the club a background will be darkened, before they choose one', async () => {
    render(<AnnouncementEditorPage />);

    expect(
      screen.getByText('Background images are darkened so the text stays readable.')
    ).toBeInTheDocument();
  });

  it('reports a refusal in the server’s own words', async () => {
    execute.mockRejectedValue(new Error('Shows until must be after shows from'));
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'AGM');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Shows until must be after shows from')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('an existing announcement', () => {
  beforeEach(() => {
    params.current = { id: 'ann-1' };
  });

  it('opens on what was written', async () => {
    render(<AnnouncementEditorPage />);

    expect(await screen.findByDisplayValue('Clubhouse closed Saturday')).toBeInTheDocument();
    expect(execute).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/orgadmin/announcements/ann-1',
    });
  });

  it('previews the picture the club already attached', async () => {
    execute.mockResolvedValue({
      ...saved,
      imageUrl: 'https://signed.example.test/clubhouse.jpg',
      imagePlacement: 'background',
    });
    render(<AnnouncementEditorPage />);

    await screen.findByDisplayValue('Clubhouse closed Saturday');
    expect(screen.getByRole('radio', { name: 'Background' })).toBeChecked();
  });

  it('saves back to the same announcement', async () => {
    render(<AnnouncementEditorPage />);
    await screen.findByDisplayValue('Clubhouse closed Saturday');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PUT', url: '/api/orgadmin/announcements/ann-1' })
      )
    );
  });

  it('removes the image against the saved announcement', async () => {
    execute.mockResolvedValue({ ...saved, imageUrl: 'https://signed', imagePlacement: 'header' });
    render(<AnnouncementEditorPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove image' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/orgadmin/announcements/ann-1/image',
      })
    );
  });
});

describe('windowError', () => {
  const at = (iso: string) => new Date(iso);

  it('accepts a window that runs forwards', () => {
    expect(
      windowError({ startsAt: at('2026-09-01T09:00:00Z'), endsAt: at('2026-09-06T18:00:00Z') })
    ).toBeNull();
  });

  it('refuses a window that ends before it begins', () => {
    // Such a notice can never appear, and nothing downstream would report it.
    expect(
      windowError({ startsAt: at('2026-09-06T18:00:00Z'), endsAt: at('2026-09-01T09:00:00Z') })
    ).toBe('endBeforeStart');
  });

  it('refuses a window of no length at all', () => {
    const moment = at('2026-09-01T09:00:00Z');
    expect(windowError({ startsAt: moment, endsAt: moment })).toBe('endBeforeStart');
  });

  it('names which end is missing', () => {
    expect(windowError({ startsAt: null, endsAt: at('2026-09-06T18:00:00Z') })).toBe('startMissing');
    expect(windowError({ startsAt: at('2026-09-01T09:00:00Z'), endsAt: null })).toBe('endMissing');
  });

  it('treats a half-typed date as missing rather than as a window', () => {
    expect(windowError({ startsAt: new Date('nonsense'), endsAt: at('2026-09-06T18:00:00Z') })).toBe(
      'startMissing'
    );
  });
});

/**
 * The optional link.
 *
 * The same idea as a platform post's, one tier down: a labelled button under
 * the words. "Summer camp booking is open" is half a notice if the member then
 * has to go and find the camps page themselves.
 */
describe('the link', () => {
  it('previews as the button a member will see', async () => {
    render(<AnnouncementEditorPage />);

    await userEvent.type(screen.getByLabelText(/Link text/), 'Book a place');
    await userEvent.type(screen.getByLabelText(/Link address/), 'https://kildarehunt.test/camp');

    const button = await screen.findByRole('link', { name: 'Book a place' });
    expect(button).toHaveAttribute('href', 'https://kildarehunt.test/camp');
  });

  it('previews nothing until both halves are there', async () => {
    // Half a link renders as none, here and on the member's page.
    render(<AnnouncementEditorPage />);

    await userEvent.type(screen.getByLabelText(/Link text/), 'Book a place');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('holds the save while a link is half-written', async () => {
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Summer camp');
    await userEvent.type(screen.getByLabelText(/Link address/), 'https://kildarehunt.test');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(
      screen.getByText('A link needs both the words on the button and a web address')
    ).toBeInTheDocument();
  });

  it('says so before saving when the address is not a web address', async () => {
    // The server refuses it too; being told at the field is the courtesy.
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Summer camp');
    await userEvent.type(screen.getByLabelText(/Link text/), 'Book');
    await userEvent.type(screen.getByLabelText(/Link address/), 'kildarehunt.test/camp');

    expect(screen.getByText('Start the address with http:// or https://')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('sends both halves, trimmed', async () => {
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Summer camp');
    await userEvent.type(screen.getByLabelText(/Link text/), '  Book a place  ');
    await userEvent.type(screen.getByLabelText(/Link address/), '  https://kildarehunt.test/camp  ');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            linkLabel: 'Book a place',
            linkUrl: 'https://kildarehunt.test/camp',
          }),
        })
      )
    );
  });

  it('sends nulls where the club left it empty', async () => {
    // Most notices point nowhere; that has to be sayable.
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Clubhouse closed');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ linkLabel: null, linkUrl: null }),
        })
      )
    );
  });

  it('opens on the link a club already wrote', async () => {
    params.current = { id: 'ann-1' };
    execute.mockResolvedValue({
      ...saved,
      link: { label: 'Book a place', url: 'https://kildarehunt.test/camp' },
    });

    render(<AnnouncementEditorPage />);

    expect(await screen.findByDisplayValue('Book a place')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://kildarehunt.test/camp')).toBeInTheDocument();
  });
});

describe('linkError', () => {
  it('accepts a notice that points nowhere', () => {
    expect(linkError('', '')).toBeNull();
    expect(linkError('  ', '  ')).toBeNull();
  });

  it('refuses half a link, either half', () => {
    expect(linkError('Book a place', '')).toBe('needsBoth');
    expect(linkError('', 'https://kildarehunt.test')).toBe('needsBoth');
  });

  it('refuses anything that is not http or https', () => {
    expect(linkError('Book', 'kildarehunt.test')).toBe('notAWebAddress');
    expect(linkError('Email', 'mailto:secretary@kildarehunt.test')).toBe('notAWebAddress');
    // eslint-disable-next-line no-script-url
    expect(linkError('Book', 'javascript:alert(1)')).toBe('notAWebAddress');
  });

  it('accepts both schemes', () => {
    expect(linkError('Book', 'https://kildarehunt.test/camp')).toBeNull();
    expect(linkError('Book', 'http://kildarehunt.test/camp')).toBeNull();
  });
});

/**
 * When the picture does not arrive.
 *
 * Reported from the product: a club edited a notice, added an image, pressed
 * Save, and the image was never stored. Two faults, one behind the other —
 * `useApi` forced `application/json` onto a multipart body so the server found
 * no file, and this page then dropped the resulting refusal on the floor and
 * navigated away as though it had worked.
 *
 * The first is fixed in `useApi`. These are about the second: a failure must be
 * said out loud, and must leave the club somewhere they can retry.
 */
describe('when the image upload fails', () => {
  const withFailingUpload = () =>
    execute.mockImplementation(({ url }: { url: string }) =>
      url.endsWith('/image')
        ? Promise.reject(new Error('Choose an image to upload'))
        : Promise.resolve(saved)
    );

  const chooseImage = () => {
    const file = new File(['x'], 'clubhouse.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Image (optional)'), { target: { files: [file] } });
  };

  it('says so instead of reporting a save that lost the picture', async () => {
    params.current = { id: 'ann-1' };
    withFailingUpload();
    render(<AnnouncementEditorPage />);
    await screen.findByDisplayValue('Clubhouse closed Saturday');

    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Choose an image to upload')).toBeInTheDocument();
    // Still here: the club can try again, or remove the image and save without.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the chosen file, so Save retries the upload', async () => {
    // Clearing it would send the club back to find the photograph again.
    params.current = { id: 'ann-1' };
    withFailingUpload();
    render(<AnnouncementEditorPage />);
    await screen.findByDisplayValue('Clubhouse closed Saturday');

    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Choose an image to upload');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        execute.mock.calls.filter(([call]) => String(call.url).endsWith('/image')).length
      ).toBe(2)
    );
  });

  it('does not write a second notice when a new one’s image fails', async () => {
    /*
     * The create path's own hazard: the announcement exists after the first
     * press, so a retry has to correct it rather than create another. Without
     * this a club with a failing upload would collect a notice per attempt.
     */
    withFailingUpload();
    render(<AnnouncementEditorPage />);
    await userEvent.type(screen.getByLabelText(/Title/), 'Summer camp');

    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Choose an image to upload');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(
        execute.mock.calls.filter(([call]) => call.method === 'PUT').length
      ).toBe(1)
    );
    // One create, whatever happens afterwards.
    expect(execute.mock.calls.filter(([call]) => call.method === 'POST' && !String(call.url).endsWith('/image')).length).toBe(1);
  });

  it('sends the file as a multipart body, not as JSON', async () => {
    // What the server needs in order to find a file at all.
    params.current = { id: 'ann-1' };
    render(<AnnouncementEditorPage />);
    await screen.findByDisplayValue('Clubhouse closed Saturday');

    chooseImage();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const [upload] = execute.mock.calls
        .map(([call]) => call)
        .filter((call) => String(call.url).endsWith('/image'));
      expect(upload.data).toBeInstanceOf(FormData);
      // And a refusal must reach this page rather than becoming `null`.
      expect(upload.throwOnError).toBe(true);
    });
  });
});
