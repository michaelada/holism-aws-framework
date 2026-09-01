import React from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';

/**
 * A name offered under the field, ready to click.
 *
 * Mirrors the server's `EntrantSuggestion`. `memberId` is null for a name that
 * was typed rather than held as a membership — it is still worth offering back,
 * and is often the one the member wants.
 */
export interface EntrantSuggestion {
  name: string;
  memberId: string | null;
  /** The membership type, or the club it is with. Shown beside the name. */
  detail?: string | null;
}

/** One person the entry could be for. Mirrors the server's `EntrantCandidate`. */
export interface EntrantOption {
  memberId: string;
  name: string;
  membershipTypeName?: string | null;
  membershipNumber?: string | null;
  /** The member's own club — set only when it differs from the host's. */
  organisationName?: string | null;
  /** Already entered in this activity: shown, but not selectable. */
  alreadyEntered?: boolean;
}

/**
 * What the field holds. A chosen member carries an id; a typed name does not.
 *
 * Both, rather than one or the other, because the name is what the entry list
 * prints and the id is what proves eligibility — and a caller that had only the
 * id would have to look the name up again to show it.
 */
export interface EntrantValue {
  memberId: string | null;
  name: string;
}

export interface EntrantNameFieldProps {
  value: EntrantValue;
  onChange: (value: EntrantValue) => void;
  /** Called as the member types; the caller debounces and searches. */
  onSearch?: (query: string) => void;
  options?: EntrantOption[];
  loading?: boolean;
  /**
   * Whether there is a roster to complete against. False renders a plain text
   * box — the right answer for a club that does not run memberships, not a
   * degraded one.
   */
  autocomplete?: boolean;
  /** Whether a name matching nobody may be submitted. Open entries only. */
  allowFreeText?: boolean;
  disabled?: boolean;
  /** Shown once the member has left a field they have not satisfied. */
  error?: string | null;
  onBlur?: () => void;
  /**
   * Names to offer beneath the field, one click away.
   *
   * Two lists rather than one because they answer different questions — who
   * this account *may* enter, and who it *has* entered — and a merged list
   * would have to pick which a name was. Either may be empty; both empty
   * renders nothing at all.
   */
  suggestions?: {
    memberships?: EntrantSuggestion[];
    recent?: EntrantSuggestion[];
  };
  labels: {
    label: string;
    placeholder?: string;
    helperText?: string;
    noMatches?: string;
    alreadyEntered?: string;
    loading?: string;
    /**
     * Heading for the second suggestion row only.
     *
     * The memberships have none. The hint above them already says what to do
     * with the whole block, and a heading between the two would have been a
     * label on the obvious — these are the names on the account, and the chips
     * carry the membership type anyway. "Used before" earns its heading
     * because it says something the names cannot: that they were typed on a
     * previous entry rather than held as a membership.
     */
    usedBefore?: string;
    /**
     * That the names below can be clicked.
     *
     * Said once, in words, rather than left to the chips looking clickable.
     * They are read as labels — a membership type, a category, something the
     * form is telling you — until something says otherwise, and a member who
     * reads them that way types the name that was sitting right there.
     */
    suggestionsHint?: string;
  };
}

/**
 * Who the entry is for — the field every event entry form now opens with.
 *
 * Built here rather than in the account app because it is not specific to one
 * front end: the same question is asked wherever an entry is created, and an
 * org admin entering a phone booking needs exactly this field (CLAUDE.md §1.5).
 * It is deliberately presentational — it neither fetches nor debounces, and
 * every string arrives as a prop — so the app that owns the API and the
 * translations keeps owning them.
 *
 * ## Why a strict mode rather than validate-on-submit
 *
 * On a members-only activity a typed name is exactly the thing being excluded,
 * so the field refuses to hold one: clearing an unmatched value on blur tells
 * the member at the field, not after they have filled in the rest of the form
 * and pressed a button. `freeSolo` is switched off in that mode, which is what
 * makes MUI treat the text as a filter over the roster rather than as an answer
 * in its own right.
 */
export const EntrantNameField: React.FC<EntrantNameFieldProps> = ({
  value,
  onChange,
  onSearch,
  options = [],
  loading = false,
  autocomplete = false,
  allowFreeText = true,
  disabled = false,
  error,
  onBlur,
  suggestions,
  labels,
}) => {
  /*
   * No roster to complete against: a plain box.
   *
   * A club that does not run memberships has nothing to offer, and an
   * Autocomplete that never suggests anything is a text field that also spins.
   */
  /*
   * The suggestion rows, under whichever field is drawn.
   *
   * Offered for a plain box too: a club with no roster still has the names this
   * account entered last time, and those are exactly the ones worth a click
   * when there is nothing to complete against.
   */
  const suggestionRows = (
    <SuggestionRows
      suggestions={suggestions}
      disabled={disabled}
      onPick={onChange}
      labels={labels}
    />
  );

  if (!autocomplete) {
    return (
      <Box>
      <TextField
        fullWidth
        required
        label={labels.label}
        placeholder={labels.placeholder}
        helperText={error || labels.helperText}
        error={Boolean(error)}
        disabled={disabled}
        value={value.name}
        onBlur={onBlur}
        onChange={(event) => onChange({ memberId: null, name: event.target.value })}
        inputProps={{ maxLength: 255 }}
      />
      {suggestionRows}
      </Box>
    );
  }

  const selected = value.memberId
    ? options.find((option) => option.memberId === value.memberId) ?? {
        memberId: value.memberId,
        name: value.name,
      }
    : null;

  return (
    <Box>
    <Autocomplete<EntrantOption, false, false, true>
      freeSolo={allowFreeText as true}
      disabled={disabled}
      options={options}
      loading={loading}
      // The server has already matched on name and membership number; filtering
      // again here would hide rows it deliberately returned.
      filterOptions={(x) => x}
      value={selected}
      inputValue={value.name}
      getOptionDisabled={(option) => Boolean(option.alreadyEntered)}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
      isOptionEqualToValue={(option, chosen) => option.memberId === chosen.memberId}
      onInputChange={(_event, input, reason) => {
        /*
         * `reset` fires when MUI writes the chosen option's label back into the
         * box. Treating it as typing would clear the id we have just set.
         */
        if (reason === 'reset') return;
        onChange({ memberId: null, name: input });
        onSearch?.(input);
      }}
      onChange={(_event, chosen) => {
        if (!chosen) {
          onChange({ memberId: null, name: '' });
          return;
        }
        if (typeof chosen === 'string') {
          onChange({ memberId: null, name: chosen });
          return;
        }
        onChange({ memberId: chosen.memberId, name: chosen.name });
      }}
      onBlur={() => {
        /*
         * A half-typed name on a members-only activity is not an answer, and
         * leaving it in the box would look like one. Cleared on the way out so
         * the member is never holding something the server will refuse.
         */
        if (!allowFreeText && !value.memberId && value.name) {
          onChange({ memberId: null, name: '' });
        }
        onBlur?.();
      }}
      noOptionsText={labels.noMatches}
      loadingText={labels.loading}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.memberId}>
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{option.name}</Typography>
              {/*
                * Which club, when it is not this one. Two members called Sarah
                * Byrne in a federation-wide rally are otherwise identical rows,
                * and the entrant is the one thing this field must get right.
                */}
              {option.organisationName && (
                <Chip size="small" variant="outlined" label={option.organisationName} />
              )}
              {option.alreadyEntered && (
                <Chip size="small" color="default" label={labels.alreadyEntered} />
              )}
            </Box>
            {(option.membershipTypeName || option.membershipNumber) && (
              <Typography variant="caption" color="text.secondary">
                {[option.membershipTypeName, option.membershipNumber]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          required
          label={labels.label}
          placeholder={labels.placeholder}
          helperText={error || labels.helperText}
          error={Boolean(error)}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
      {suggestionRows}
    </Box>
  );
};

/**
 * The names offered beneath the field.
 *
 * Chips rather than another list: they sit under the field without competing
 * with the autocomplete's own dropdown, and a row of four reads as "these are
 * the ones you mean" where four more list rows would read as more to search
 * through.
 *
 * A membership chip carries its `memberId`, so clicking it selects the
 * membership rather than merely typing the name — which matters on a
 * members-only activity, where a name alone is not an answer.
 */
const SuggestionRows: React.FC<{
  suggestions?: { memberships?: EntrantSuggestion[]; recent?: EntrantSuggestion[] };
  disabled: boolean;
  onPick: (value: EntrantValue) => void;
  labels: { usedBefore?: string; suggestionsHint?: string };
}> = ({ suggestions, disabled, onPick, labels }) => {
  const memberships = suggestions?.memberships ?? [];
  const recent = suggestions?.recent ?? [];

  if (memberships.length === 0 && recent.length === 0) return null;

  const row = (heading: string | undefined, items: EntrantSuggestion[]) =>
    items.length === 0 ? null : (
      <Box sx={{ mt: 1 }}>
        {heading && (
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            {heading}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {items.map((item) => (
            <Chip
              key={`${item.memberId ?? 'typed'}-${item.name}`}
              size="small"
              variant="outlined"
              clickable
              disabled={disabled}
              label={item.detail ? `${item.name} · ${item.detail}` : item.name}
              onClick={() => onPick({ memberId: item.memberId, name: item.name })}
            />
          ))}
        </Box>
      </Box>
    );

  return (
    <>
      {/*
        Once, above both rows, rather than repeated on each heading.
        
        It is one instruction and it covers everything below it; saying it twice
        makes two short lists look like two separate mechanisms.
      */}
      {labels.suggestionsHint && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          {labels.suggestionsHint}
        </Typography>
      )}
      {row(undefined, memberships)}
      {row(labels.usedBefore, recent)}
    </>
  );
};

export default EntrantNameField;
