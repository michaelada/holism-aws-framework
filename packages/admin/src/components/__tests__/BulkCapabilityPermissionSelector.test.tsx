import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BulkCapabilityPermissionSelector } from '../BulkCapabilityPermissionSelector';

/**
 * Granting a role its permissions, one capability at a time or in a batch.
 *
 * What this decides is what somebody holding the role can *do*, so the two
 * things worth pinning are both about not granting more than was asked for.
 * A capability already granted must drop out of the "add" list — offering it
 * again lets a second, different permission level silently overwrite the
 * first. And a bulk add must apply the level that is on screen at the moment
 * it runs, not the one that was there when the capabilities were ticked.
 *
 * The filter matters too: a club that does not have the merchandise capability
 * should not be offered roles that grant permissions on it.
 */

const CAPABILITIES = [
  { id: 'c-1', name: 'memberships', displayName: 'Memberships', description: 'Members' },
  { id: 'c-2', name: 'events', displayName: 'Events', description: 'Events' },
  { id: 'c-3', name: 'merchandise', displayName: 'Merchandise', description: 'Shop' },
];

let onChange: ReturnType<typeof vi.fn>;

const renderSelector = (
  selectedPermissions: Record<string, 'admin' | 'write' | 'read'> = {},
  availableCapabilities?: string[]
) => {
  onChange = vi.fn();
  return render(
    <BulkCapabilityPermissionSelector
      capabilities={CAPABILITIES}
      selectedPermissions={selectedPermissions}
      onChange={onChange}
      availableCapabilities={availableCapabilities}
    />
  );
};

/** What the selector most recently reported upward. */
const reported = () => onChange.mock.calls.at(-1)![0];

const clickButton = (pattern: RegExp) =>
  fireEvent.click(screen.getAllByRole('button').find((b) => pattern.test(b.textContent ?? ''))!);

/* The checkbox sits beside the capability's name rather than inside a label,
 * so the row it belongs to is what identifies it. */
const tickCapability = (displayName: string) => {
  // The innermost box holding exactly one checkbox: an outer container would
  // match the name too and toggle whichever capability came first.
  const row = Array.from(document.querySelectorAll('.MuiBox-root')).find(
    (box) =>
      box.textContent?.includes(displayName) &&
      box.querySelectorAll('input[type="checkbox"]').length === 1
  )!;
  fireEvent.click(row.querySelector('input[type="checkbox"]')!);
};

const chooseBulkLevel = (level: string) => {
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
  const listbox = screen.getByRole('listbox');
  fireEvent.click(listbox.querySelector(`[data-value="${level}"]`)!);
  // The menu's backdrop covers the Add button until it closes.
  fireEvent.keyDown(listbox, { key: 'Escape' });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BulkCapabilityPermissionSelector — what it offers', () => {
  it('offers every capability when the role has none yet', () => {
    renderSelector();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('stops offering a capability that has already been granted', () => {
    renderSelector({ memberships: 'read' });

    // Offering it again lets a second level silently overwrite the first.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('offers only the capabilities the club actually has', () => {
    renderSelector({}, ['memberships', 'events']);

    // A club with no shop should not be granted permissions on one.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('offers nothing once every capability is granted', () => {
    renderSelector({ memberships: 'read', events: 'read', merchandise: 'read' });

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});

describe('BulkCapabilityPermissionSelector — granting in a batch', () => {
  it('grants nothing until something is ticked', () => {
    renderSelector();

    clickButton(/add .*selected/i);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('grants the ticked capabilities at the chosen level', () => {
    renderSelector();

    tickCapability('Memberships');
    tickCapability('Events');
    chooseBulkLevel('write');
    clickButton(/add .*selected/i);

    expect(reported()).toEqual({ memberships: 'write', events: 'write' });
  });

  it('grants at the level showing when the add runs, not when they were ticked', () => {
    renderSelector();

    tickCapability('Memberships');
    chooseBulkLevel('admin');
    clickButton(/add .*selected/i);

    expect(reported()).toEqual({ memberships: 'admin' });
  });

  it('keeps the permissions the role already had', () => {
    renderSelector({ events: 'admin' });

    tickCapability('Memberships');
    clickButton(/add .*selected/i);

    // Replacing rather than merging would silently revoke what was granted.
    expect(reported()).toEqual({ events: 'admin', memberships: 'read' });
  });

  it('takes a capability back out of the batch when it is unticked', () => {
    renderSelector();

    tickCapability('Memberships');
    tickCapability('Events');
    tickCapability('Events');
    clickButton(/add .*selected/i);

    expect(reported()).toEqual({ memberships: 'read' });
  });

  it('ticks everything at once', () => {
    renderSelector();

    clickButton(/select all/i);
    clickButton(/add .*selected/i);

    expect(Object.keys(reported())).toHaveLength(3);
  });

  it('unticks everything again', () => {
    renderSelector();

    clickButton(/select all/i);
    clickButton(/deselect all/i);
    clickButton(/add .*selected/i);

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BulkCapabilityPermissionSelector — granting everything at one level', () => {
  it('grants every remaining capability as read', () => {
    renderSelector();

    clickButton(/all as read/i);

    expect(reported()).toEqual({ memberships: 'read', events: 'read', merchandise: 'read' });
  });

  it('leaves an existing grant alone when adding the rest', () => {
    renderSelector({ memberships: 'admin' });

    clickButton(/all as read/i);

    // The quick-add fills the gaps; it does not demote what is already granted.
    expect(reported().memberships).toBe('admin');
    expect(reported().events).toBe('read');
  });
});

describe('BulkCapabilityPermissionSelector — changing and removing a grant', () => {
  it('changes the level of a capability already granted', () => {
    renderSelector({ memberships: 'read' });

    const rowSelect = screen.getAllByRole('combobox').at(-1)!;
    fireEvent.mouseDown(rowSelect);
    fireEvent.click(screen.getByRole('listbox').querySelector('[data-value="admin"]')!);

    expect(reported()).toEqual({ memberships: 'admin' });
  });

  it('removes a grant entirely', () => {
    renderSelector({ memberships: 'read', events: 'write' });

    const remove = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.querySelector('[data-testid="DeleteIcon"]')
    );
    fireEvent.click(remove[0]);

    // Removed, not set to a lower level: no permission at all is the point.
    expect(Object.keys(reported())).toHaveLength(1);
  });
});
