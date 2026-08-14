import { Chip, ChipProps } from '@mui/material';

type Tone = 'success' | 'warning' | 'error' | 'default';

interface StatusPresentation {
  label: string;
  tone: Tone;
}

/**
 * Status vocabulary, in one place.
 *
 * Two problems this fixes. First, statuses were printed as the raw lowercase
 * enum (`active`, `inactive`) on one page and capitalised via `textTransform`
 * on another — same data, two presentations. Second, `inactive` and an
 * *unrecognised* status both mapped to the `default` chip colour, so a status
 * the UI did not understand was pixel-identical to one it did. An operator had
 * no way to tell "this club is switched off" from "this build is out of date
 * with the backend".
 *
 * Every tone also carries distinct text, so status is never conveyed by colour
 * alone.
 */
const STATUSES: Record<string, StatusPresentation> = {
  active: { label: 'Active', tone: 'success' },
  /*
   * Inactive is a real closure, not a soft one: an inactive organisation is
   * invisible to members and refuses its own administrators. It is toned
   * `warning` rather than neutral so it does not read as a dormant record
   * nobody needs to act on.
   *
   * There is no `blocked`. It allowed a third value that behaved identically to
   * this one, differing only in the colour of its chip — a severity the
   * platform never implemented. See docs/ORGANISATION_STATUS_AND_DEACTIVATION.md.
   */
  inactive: { label: 'Inactive', tone: 'warning' },
  pending: { label: 'Pending', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'error' },
};

export interface StatusChipProps extends Omit<ChipProps, 'label' | 'color'> {
  status: string | null | undefined;
}

export function StatusChip({ status, ...chipProps }: StatusChipProps) {
  if (!status) {
    return <Chip size="small" label="Not set" variant="outlined" {...chipProps} />;
  }

  const known = STATUSES[status.toLowerCase()];

  if (!known) {
    // Named explicitly rather than falling through to the same neutral chip an
    // inactive organisation gets.
    return (
      <Chip
        size="small"
        variant="outlined"
        color="warning"
        label={`Unknown: ${status}`}
        {...chipProps}
      />
    );
  }

  return <Chip size="small" color={known.tone} label={known.label} {...chipProps} />;
}
