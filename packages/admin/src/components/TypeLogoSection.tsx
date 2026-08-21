import React, { useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';

export interface TypeLogoSectionProps {
  /** The stored logo, signed for display. Empty where the type has none. */
  logoUrl?: string;
  /** A file chosen but not yet uploaded — shown in preference to the stored one. */
  pendingFile?: File | null;
  allowOverride: boolean;
  onChooseFile: (file: File | null) => void;
  onRemove?: () => void;
  onAllowOverrideChange: (allow: boolean) => void;
  /**
   * True on the create screen, where the type has no id yet. The logo is
   * uploaded straight after saving, and the copy says so rather than leaving an
   * operator wondering why nothing happened.
   */
  deferred?: boolean;
  busy?: boolean;
}

/**
 * The shared logo for an organisation type, and whether clubs may replace it.
 *
 * A federation has one mark and every branch was uploading its own copy of it —
 * the same file stored twenty times, twenty chances to be a version behind, and
 * no way to change it centrally at a rebrand. Set here, it is inherited by
 * every organisation of the type.
 *
 * The checkbox is deliberately worded around what a club may *do*, not around
 * the flag: "organisations may replace this with their own logo" is checkable
 * by somebody who has never read the schema.
 */
export const TypeLogoSection: React.FC<TypeLogoSectionProps> = ({
  logoUrl,
  pendingFile,
  allowOverride,
  onChooseFile,
  onRemove,
  onAllowOverrideChange,
  deferred = false,
  busy = false,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = pendingFile ? URL.createObjectURL(pendingFile) : logoUrl || '';

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Optional. Every organisation of this type shows this logo unless it sets one of its own.
      </Typography>

      {preview ? (
        <Box
          component="img"
          src={preview}
          alt=""
          sx={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            p: 1,
            bgcolor: 'background.paper',
          }}
        />
      ) : (
        <Box
          sx={{
            width: 120,
            height: 120,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'divider',
            color: 'text.secondary',
          }}
        >
          <ImageIcon fontSize="small" />
          <Typography variant="caption">No logo</Typography>
        </Box>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="type-logo-input"
        onChange={(event) => onChooseFile(event.target.files?.[0] ?? null)}
      />

      <Stack direction="row" spacing={1}>
        <Button variant="outlined" disabled={busy} onClick={() => fileInput.current?.click()}>
          {preview ? 'Choose a different logo' : 'Choose a logo'}
        </Button>
        {preview && onRemove && (
          <Button
            color="inherit"
            disabled={busy}
            onClick={() => {
              onChooseFile(null);
              if (fileInput.current) fileInput.current.value = '';
              onRemove();
            }}
          >
            Remove logo
          </Button>
        )}
      </Stack>

      {deferred && pendingFile && (
        <Alert severity="info">The logo is uploaded when you save this organisation type.</Alert>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={allowOverride}
            onChange={(event) => onAllowOverrideChange(event.target.checked)}
          />
        }
        label="Organisations may replace this with their own logo"
      />

      {!allowOverride && (
        /*
         * Said plainly, because it is the consequence an operator is least
         * likely to have thought through: it is not only that clubs cannot
         * upload from here on, it is that a club which already uploaded one
         * stops showing it.
         */
        <Alert severity="warning">
          Every organisation of this type will show the shared logo, and the upload control is
          removed from their branding settings. Any logo a club has already uploaded stops being
          shown.
        </Alert>
      )}

      {!allowOverride && !preview && (
        // The dead configuration, named rather than silently worked around.
        <Alert severity="info">
          There is no shared logo to inherit, so organisations keep control of their own until you
          upload one.
        </Alert>
      )}
    </Stack>
  );
};

export default TypeLogoSection;
