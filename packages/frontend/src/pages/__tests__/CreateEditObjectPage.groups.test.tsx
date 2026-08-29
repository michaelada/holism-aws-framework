import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CreateEditObjectPage from '../CreateEditObjectPage';

/**
 * The two ways an object's fields get arranged for the people filling them in:
 * **field groups**, which section a long form, and **wizard steps**, which
 * split it across pages.
 *
 * Both are ordered lists, and the order is data — it is the order sections and
 * pages appear in on a member-facing form. Every add, remove and move rewrites
 * the `order` on every sibling, because a gap or a duplicate in that sequence
 * puts two sections in the same place and the renderer picks arbitrarily.
 *
 * Removing is the sharper case: dropping index 2 out of four must leave the
 * remaining three numbered 1, 2, 3 — not 1, 2, 4.
 *
 * The fields, saving and error handling are covered in
 * CreateEditObjectPage.test.tsx.
 */

const { api, navigate, params } = vi.hoisted(() => ({
  api: {
    getFields: vi.fn(),
    getObjects: vi.fn(),
    createObject: vi.fn(),
    updateObject: vi.fn(),
  },
  navigate: vi.fn(),
  params: { current: {} as { objectShortName?: string } },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
  useParams: () => params.current,
}));

vi.mock('../../context', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataApi: () => api,
}));

const FIELDS = [
  { shortName: 'first_name', displayName: 'First Name', datatype: 'text' },
  { shortName: 'last_name', displayName: 'Last Name', datatype: 'text' },
];

const renderPage = async () => {
  render(<CreateEditObjectPage />);
  await waitFor(() => expect(api.getFields).toHaveBeenCalled());
};

/** The payload of the most recent create or update. */
const saved = () =>
  api.createObject.mock.calls.at(-1)?.[0] ?? api.updateObject.mock.calls.at(-1)?.[1];

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

const nameBoxes = (label: RegExp) => screen.getAllByLabelText(label) as HTMLInputElement[];

/** The up/down/delete controls, in the order they appear on screen. */
const iconButtons = (testId: string) =>
  Array.from(document.querySelectorAll('button')).filter((b) =>
    b.querySelector(`[data-testid="${testId}"]`)
  );

const fillIdentity = () => {
  // The identity fields live on the first tab, which stays mounted.
  fireEvent.change(screen.getByLabelText(/short name/i), { target: { value: 'member' } });
  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Member' } });
};

/* Submitting the form itself, because the save button sits outside the tab
 * panel the groups and steps are edited in. */
const save = () => fireEvent.submit(screen.getByLabelText(/short name/i).closest('form')!);

beforeEach(() => {
  vi.clearAllMocks();
  params.current = {};
  api.getFields.mockResolvedValue(FIELDS);
  api.getObjects.mockResolvedValue([]);
  api.createObject.mockResolvedValue({});
  api.updateObject.mockResolvedValue({});
});

describe('CreateEditObjectPage — field groups', () => {
  const addGroup = (name: string) => {
    clickButton(/add group/i);
    const boxes = nameBoxes(/group name/i);
    fireEvent.change(boxes[boxes.length - 1], { target: { value: name } });
  };

  it('numbers a new group after the ones already there', async () => {
    await renderPage();
    openTab(/field groups/i);

    addGroup('Personal');
    addGroup('Contact');
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { order: number }) => g.order)).toEqual([1, 2]);
  });

  it('keeps each group’s own name', async () => {
    await renderPage();
    openTab(/field groups/i);

    addGroup('Personal');
    addGroup('Contact');
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Personal',
      'Contact',
    ]);
  });

  it('closes the numbering gap when a group is removed', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');
    addGroup('Medical');

    fireEvent.click(iconButtons('DeleteIcon')[1]);
    fillIdentity();
    save();

    // 1, 2, 4 would put two sections in the same place on the rendered form.
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { order: number }) => g.order)).toEqual([1, 2]);
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Personal',
      'Medical',
    ]);
  });

  it('moves a group up and renumbers both', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');

    fireEvent.click(iconButtons('ArrowUpwardIcon')[1]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Contact',
      'Personal',
    ]);
    expect(saved().fieldGroups.map((g: { order: number }) => g.order)).toEqual([1, 2]);
  });

  it('moves a group down', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');

    fireEvent.click(iconButtons('ArrowDownwardIcon')[0]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Contact',
      'Personal',
    ]);
  });

  it('does nothing when the first group is moved up', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');

    fireEvent.click(iconButtons('ArrowUpwardIcon')[0]);
    fillIdentity();
    save();

    // Wrapping to the end would be a silent reordering nobody asked for.
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Personal',
      'Contact',
    ]);
  });

  it('does nothing when the last group is moved down', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');

    fireEvent.click(iconButtons('ArrowDownwardIcon')[1]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups.map((g: { name: string }) => g.name)).toEqual([
      'Personal',
      'Contact',
    ]);
  });

  it('edits one group’s description without disturbing the other', async () => {
    await renderPage();
    openTab(/field groups/i);
    addGroup('Personal');
    addGroup('Contact');

    const descriptions = screen.getAllByLabelText(/description/i);
    fireEvent.change(descriptions[descriptions.length - 1], {
      target: { value: 'How to reach the member' },
    });
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().fieldGroups[1].description).toBe('How to reach the member');
    expect(saved().fieldGroups[0].description).toBe('');
  });
});

describe('CreateEditObjectPage — wizard steps', () => {
  const addStep = (name: string) => {
    clickButton(/add step/i);
    const boxes = nameBoxes(/step name/i);
    fireEvent.change(boxes[boxes.length - 1], { target: { value: name } });
  };

  it('appends a new step after the ones already there', async () => {
    await renderPage();
    openTab(/wizard/i);

    addStep('About you');
    addStep('Payment');
    fillIdentity();
    save();

    // Steps carry no `order` of their own: position in the array *is* the
    // sequence a member walks, so appending has to mean appending.
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'About you',
      'Payment',
    ]);
  });

  it('keeps the remaining steps in order when one is removed', async () => {
    await renderPage();
    openTab(/wizard/i);
    addStep('About you');
    addStep('Payment');
    addStep('Confirm');

    fireEvent.click(iconButtons('DeleteIcon')[1]);
    fillIdentity();
    save();

    // A member walking a wizard follows this sequence page by page.
    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'About you',
      'Confirm',
    ]);
  });

  it('moves a step up and renumbers both', async () => {
    await renderPage();
    openTab(/wizard/i);
    addStep('About you');
    addStep('Payment');

    fireEvent.click(iconButtons('ArrowUpwardIcon')[1]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'Payment',
      'About you',
    ]);
  });

  it('moves a step down', async () => {
    await renderPage();
    openTab(/wizard/i);
    addStep('About you');
    addStep('Payment');

    fireEvent.click(iconButtons('ArrowDownwardIcon')[0]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'Payment',
      'About you',
    ]);
  });

  it('does nothing at the ends of the sequence', async () => {
    await renderPage();
    openTab(/wizard/i);
    addStep('About you');
    addStep('Payment');

    fireEvent.click(iconButtons('ArrowUpwardIcon')[0]);
    fireEvent.click(iconButtons('ArrowDownwardIcon')[1]);
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'About you',
      'Payment',
    ]);
  });

  it('edits one step without disturbing the other', async () => {
    await renderPage();
    openTab(/wizard/i);
    addStep('About you');
    addStep('Payment');

    const boxes = nameBoxes(/step name/i);
    fireEvent.change(boxes[0], { target: { value: 'Your details' } });
    fillIdentity();
    save();

    await waitFor(() => expect(saved()).toBeDefined());
    expect(saved().wizardConfig.steps.map((s: { name: string }) => s.name)).toEqual([
      'Your details',
      'Payment',
    ]);
  });
});
