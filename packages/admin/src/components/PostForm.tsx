import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { PlatformPost, PlatformPostInput, PostLink } from '../types/post.types';
import { API_BASE_URL } from '../services/apiBaseUrl';

export interface PostFormValues extends PlatformPostInput {}

interface PostFormProps {
  initial?: PlatformPost | null;
  saving?: boolean;
  /** The chosen file is handed back so the caller can upload it after saving. */
  onSubmit: (values: PostFormValues, image: File | null, removeImage: boolean) => void;
  onCancel: () => void;
  submitLabel: string;
}

/**
 * The toolbar an announcement actually needs.
 *
 * Deliberately short. The body is rendered on a login page whose styling the
 * author cannot see while writing, and every extra control is a way to produce
 * something that looks wrong there — font sizes and colours especially, which
 * would fight the two themes this is rendered into. The server's sanitiser
 * allows roughly this set and no more, so offering more would be offering
 * formatting that is silently dropped.
 */
const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ header: [2, 3, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const emptyLink = (): PostLink => ({ label: '', url: '' });

export const PostForm: React.FC<PostFormProps> = ({
  initial,
  saving = false,
  onSubmit,
  onCancel,
  submitLabel,
}) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [links, setLinks] = useState<PostLink[]>(initial?.links ?? []);
  const [status, setStatus] = useState<'active' | 'inactive'>(initial?.status ?? 'inactive');
  const [onAccount, setOnAccount] = useState(initial?.showOnAccountLogin ?? false);
  const [onOrgadmin, setOnOrgadmin] = useState(initial?.showOnOrgadminLogin ?? false);

  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<string[]>([]);

  /** What the image area should show: a new choice, the stored one, or nothing. */
  const previewUrl = image
    ? URL.createObjectURL(image)
    : !removeImage && initial?.imageUrl
      ? `${API_BASE_URL}${initial.imageUrl}`
      : null;

  const setLink = (index: number, patch: Partial<PostLink>) =>
    setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  const validate = (): string[] => {
    const found: string[] = [];
    if (!title.trim()) found.push('A post needs a title.');

    links.forEach((link, index) => {
      const position = `Link ${index + 1}`;
      if (!link.label.trim() || !link.url.trim()) {
        found.push(`${position} needs both display text and a URL.`);
        return;
      }
      /*
       * Checked here as well as on the server. The server is what protects the
       * login pages; this is so an author is told at the form rather than after
       * a save that looks like it worked and then did not.
       */
      if (!/^https?:\/\//i.test(link.url.trim())) {
        found.push(`${position} must start with http:// or https://`);
      }
    });

    return found;
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;

    onSubmit(
      {
        title: title.trim(),
        body,
        links: links.map((link) => ({ label: link.label.trim(), url: link.url.trim() })),
        status,
        showOnAccountLogin: onAccount,
        showOnOrgadminLogin: onOrgadmin,
      },
      image,
      removeImage
    );
  };

  return (
    <Stack spacing={3}>
      {errors.length > 0 && (
        <Alert severity="warning">
          {errors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <TextField
          fullWidth
          required
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          inputProps={{ maxLength: 255 }}
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" gutterBottom>
          Message
        </Typography>
        <Box
          sx={{
            mb: 2,
            '& .ql-container': { minHeight: 180, fontSize: '1rem' },
            '& .ql-editor': { minHeight: 180 },
          }}
        >
          <ReactQuill theme="snow" value={body} onChange={setBody} modules={QUILL_MODULES} />
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Image
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Optional. Shown across the top of the post. It is served publicly, so use nothing that
          should not be seen by someone who has not signed in.
        </Typography>

        {previewUrl ? (
          <Box sx={{ mb: 2 }}>
            <Box
              component="img"
              src={previewUrl}
              alt=""
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 200,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              mb: 2,
              p: 3,
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ImageIcon fontSize="small" />
            <Typography variant="body2">No image</Typography>
          </Box>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          data-testid="post-image-input"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            setImage(chosen);
            // Choosing a replacement is not also a removal.
            if (chosen) setRemoveImage(false);
          }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => fileInput.current?.click()}>
            {previewUrl ? 'Choose a different image' : 'Choose an image'}
          </Button>
          {previewUrl && (
            <Button
              color="inherit"
              onClick={() => {
                setImage(null);
                setRemoveImage(true);
                if (fileInput.current) fileInput.current.value = '';
              }}
            >
              Remove image
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Links
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Optional. Shown as a row of buttons under the message.
        </Typography>

        <Stack spacing={2}>
          {links.map((link, index) => (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} key={index}>
              <TextField
                label="Display text"
                value={link.label}
                onChange={(event) => setLink(index, { label: event.target.value })}
                sx={{ flex: 1 }}
                inputProps={{ 'aria-label': `Link ${index + 1} display text` }}
              />
              <TextField
                label="URL"
                placeholder="https://"
                value={link.url}
                onChange={(event) => setLink(index, { url: event.target.value })}
                sx={{ flex: 2 }}
                inputProps={{ 'aria-label': `Link ${index + 1} URL` }}
              />
              <IconButton
                aria-label={`Remove link ${index + 1}`}
                onClick={() => setLinks((current) => current.filter((_, i) => i !== index))}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>

        <Button
          startIcon={<AddIcon />}
          onClick={() => setLinks((current) => [...current, emptyLink()])}
          sx={{ mt: links.length > 0 ? 2 : 0 }}
        >
          Add a link
        </Button>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <TextField
          select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}
          sx={{ minWidth: 220, mb: 1 }}
          helperText="Only active posts appear on a login page."
        >
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Where it appears
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={onAccount}
                onChange={(event) => setOnAccount(event.target.checked)}
              />
            }
            label="Show on all account login pages"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={onOrgadmin}
                onChange={(event) => setOnOrgadmin(event.target.checked)}
              />
            }
            label="Show on all org admin login pages"
          />
        </FormGroup>

        {status === 'active' && !onAccount && !onOrgadmin && (
          /*
           * Not an error: an active post on neither page is a legitimate state,
           * and refusing it would mean an author could not finish a post before
           * deciding where it goes. Said out loud, though, because "active" and
           * "nobody sees it" read as a contradiction.
           */
          <Alert severity="info" sx={{ mt: 2 }}>
            This post is active but is not shown on either login page, so nobody will see it yet.
          </Alert>
        )}
      </Paper>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </Stack>
    </Stack>
  );
};

export default PostForm;
