import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { enGB } from 'date-fns/locale';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { AnnouncementCard } from '@aws-web-framework/components';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { Announcement, IMAGE_PLACEMENTS, ImagePlacement } from '../types/announcement.types';

/**
 * Writing an announcement, beside the card a member will see.
 *
 * **The preview is the member's card**, not a drawing of one: the same
 * `AnnouncementCard` the account application renders, from the shared component
 * library. A preview built separately drifts from the thing it previews, and
 * the first thing it gets wrong is always what the preview existed to check —
 * how long a title runs before it wraps, how dark a photograph comes out under
 * the scrim.
 *
 * It renders from the **form's state**, not from what is saved, so a club sees
 * the effect of a word before committing to it.
 */

const QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

/** Both ends of the window, as the pickers want them. */
interface Window {
  startsAt: Date | null;
  endsAt: Date | null;
}

/** A sensible first window: from now until a week from now. */
const defaultWindow = (now: Date = new Date()): Window => ({
  startsAt: now,
  endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
});

/**
 * What is wrong with the link, if anything.
 *
 * Both halves or neither, and `http`/`https` only — the same rules the service
 * applies, checked here so a club is told before they save rather than after.
 * The server is still the authority: this is a courtesy, not the gate.
 */
export const linkError = (label: string, url: string): 'needsBoth' | 'notAWebAddress' | null => {
  const text = label.trim();
  const href = url.trim();

  if (!text && !href) return null;
  if (!text || !href) return 'needsBoth';
  return /^https?:\/\/\S+$/i.test(href) ? null : 'notAWebAddress';
};

export const windowError = (window: Window): 'startMissing' | 'endMissing' | 'endBeforeStart' | null => {
  if (!window.startsAt || Number.isNaN(window.startsAt.getTime())) return 'startMissing';
  if (!window.endsAt || Number.isNaN(window.endsAt.getTime())) return 'endMissing';
  // Refused here as well as by the server: a window that ends before it begins
  // can never be shown, and a club would simply never see their notice.
  if (window.endsAt <= window.startsAt) return 'endBeforeStart';
  return null;
};

const AnnouncementEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();

  /**
   * The announcement this page is writing to, once there is one.
   *
   * A new announcement becomes an existing one the moment it saves, and that
   * matters when the image upload that follows fails: the club is still on this
   * page, and pressing Save again must correct the notice it just created
   * rather than write a second one.
   */
  const [createdId, setCreatedId] = useState<string | null>(null);
  const targetId = id ?? createdId;
  const editing = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [window, setWindow] = useState<Window>(defaultWindow());
  const [placement, setPlacement] = useState<ImagePlacement>('header');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement | null>(null);
  /**
   * The file a club has chosen but not yet uploaded.
   *
   * On a new announcement there is no row for an image to belong to, so the
   * choice is held here and uploaded once the announcement is saved. The
   * preview shows it immediately from a blob URL, because choosing a picture
   * should look like choosing a picture.
   */
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const announcement: Announcement | null = await execute({
        method: 'GET',
        url: `/api/orgadmin/announcements/${id}`,
      });
      if (!announcement) {
        setError(t('announcements.loadFailed'));
        return;
      }
      setTitle(announcement.title);
      setDescription(announcement.description);
      setWindow({
        startsAt: new Date(announcement.startsAt),
        endsAt: new Date(announcement.endsAt),
      });
      setPlacement(announcement.imagePlacement ?? 'header');
      setImageUrl(announcement.imageUrl);
      setLinkLabel(announcement.link?.label ?? '');
      setLinkUrl(announcement.link?.url ?? '');
    } catch (failure) {
      console.error('Failed to load the announcement:', failure);
      setError(t('announcements.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [execute, id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Revoked when it is replaced or the page goes: a blob URL holds the file in
   * memory until it is released, and an editor somebody leaves open while
   * trying photographs would hold every one of them.
   */
  const pendingUrl = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage]
  );
  useEffect(() => () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
  }, [pendingUrl]);

  const previewImage = pendingUrl ?? imageUrl;

  const windowFault = windowError(window);
  const linkFault = linkError(linkLabel, linkUrl);
  const canSave = title.trim().length > 0 && !windowFault && !linkFault && !saving;

  /**
   * Uploads the chosen file against a saved announcement.
   *
   * `throwOnError`, so a refusal reaches the caller: `execute` answers `null` on
   * an error otherwise, and this used to swallow it and navigate away — the
   * notice was saved, the picture was not, and nothing said so.
   */
  const uploadImage = async (announcementId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    body.append('placement', placement);
    const saved: Announcement | null = await execute({
      method: 'POST',
      url: `/api/orgadmin/announcements/${announcementId}/image`,
      data: body,
      throwOnError: true,
    });
    if (saved) setImageUrl(saved.imageUrl);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description,
        startsAt: window.startsAt?.toISOString(),
        endsAt: window.endsAt?.toISOString(),
        // Only meaningful with an image; the server ignores it otherwise.
        imagePlacement: previewImage ? placement : null,
        // Trimmed here as well as on the server, so what is previewed and what
        // is stored are the same string.
        linkLabel: linkLabel.trim() || null,
        linkUrl: linkUrl.trim() || null,
      };

      const saved: Announcement | null = targetId
        ? await execute({
            method: 'PUT',
            url: `/api/orgadmin/announcements/${targetId}`,
            data: payload,
            throwOnError: true,
          })
        : await execute({
            method: 'POST',
            url: '/api/orgadmin/announcements',
            data: payload,
            throwOnError: true,
          });

      if (!saved) throw new Error(t('announcements.saveFailed'));
      setCreatedId(saved.id);

      /*
       * The image goes second, against a row that now exists — and a failure
       * here stops the departure. The notice is saved either way; leaving for
       * the list would report a picture that is not there.
       */
      if (pendingImage) {
        try {
          await uploadImage(saved.id, pendingImage);
          // Uploaded: it belongs to the announcement now, not to this form.
          setPendingImage(null);
        } catch (failure) {
          /*
           * The file is deliberately kept, so Save retries the upload rather
           * than asking the club to find the photograph again.
           */
          throw new Error(
            failure instanceof Error && failure.message
              ? failure.message
              : t('announcements.imageUploadFailed')
          );
        }
      }

      navigate('/announcements');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('announcements.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async () => {
    setPendingImage(null);
    if (!targetId || !imageUrl) {
      setImageUrl(null);
      return;
    }
    try {
      await execute({ method: 'DELETE', url: `/api/orgadmin/announcements/${targetId}/image` });
      setImageUrl(null);
    } catch (failure) {
      console.error('Failed to remove the image:', failure);
      setError(t('announcements.imageRemoveFailed'));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {editing ? t('announcements.editTitle') : t('announcements.createTitle')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                required
                label={t('announcements.fields.title')}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                inputProps={{ maxLength: 255 }}
              />

              <Box>
                <FormLabel>{t('announcements.fields.description')}</FormLabel>
                <Box sx={{ mt: 1, '& .ql-container': { minHeight: 160 } }}>
                  <ReactQuill
                    theme="snow"
                    value={description}
                    onChange={setDescription}
                    modules={QUILL_MODULES}
                  />
                </Box>
              </Box>

              {/*
                Under the words it belongs to, and above the dates: a link is
                part of what the notice says, while the window is about when it
                is said.
              */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label={t('announcements.fields.linkLabel')}
                    value={linkLabel}
                    onChange={(event) => setLinkLabel(event.target.value)}
                    inputProps={{ maxLength: 120 }}
                    error={linkFault === 'needsBoth' && linkLabel.trim().length === 0}
                    helperText={t('announcements.fields.linkLabelHelp')}
                  />
                </Grid>
                <Grid item xs={12} sm={7}>
                  <TextField
                    fullWidth
                    label={t('announcements.fields.linkUrl')}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://"
                    error={Boolean(linkFault) && linkFault !== 'needsBoth' ? true : linkFault === 'needsBoth' && linkUrl.trim().length === 0}
                    helperText={
                      linkFault ? t(`announcements.errors.${linkFault}`) : t('announcements.fields.linkUrlHelp')
                    }
                  />
                </Grid>
              </Grid>

              {/*
                The provider sits here rather than in the library: through the
                source alias Vite can load a second copy of
                `@mui/x-date-pickers`, and a provider inside a shared component
                would belong to a different module instance than the pickers
                rendered here — its context would never reach them.
              */}
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DateTimePicker
                      label={t('announcements.fields.startsAt')}
                      value={window.startsAt}
                      onChange={(value) => setWindow((previous) => ({ ...previous, startsAt: value }))}
                      slotProps={{ textField: { fullWidth: true, required: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DateTimePicker
                      label={t('announcements.fields.endsAt')}
                      value={window.endsAt}
                      onChange={(value) => setWindow((previous) => ({ ...previous, endsAt: value }))}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          // The fault belongs on the field that has to change.
                          error: windowFault === 'endBeforeStart',
                          helperText:
                            windowFault === 'endBeforeStart'
                              ? t('announcements.errors.endBeforeStart')
                              : ' ',
                        },
                      }}
                    />
                  </Grid>
                </Grid>
              </LocalizationProvider>

              <Box>
                <FormLabel>{t('announcements.fields.image')}</FormLabel>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ImageIcon />}
                    onClick={() => fileInput.current?.click()}
                  >
                    {t('announcements.actions.chooseImage')}
                  </Button>
                  {previewImage && (
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={removeImage}
                    >
                      {t('announcements.actions.removeImage')}
                    </Button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    hidden
                    aria-label={t('announcements.fields.image')}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setPendingImage(file);
                    }}
                  />
                </Stack>
              </Box>

              <FormControl disabled={!previewImage}>
                <FormLabel>{t('announcements.fields.placement')}</FormLabel>
                <RadioGroup
                  row
                  value={placement}
                  onChange={(event) => setPlacement(event.target.value as ImagePlacement)}
                >
                  {IMAGE_PLACEMENTS.map((option) => (
                    <FormControlLabel
                      key={option}
                      value={option}
                      control={<Radio />}
                      label={t(`announcements.placements.${option}`)}
                    />
                  ))}
                </RadioGroup>
                {/* The club is told what will happen to their photograph
                    rather than discovering it in the preview. */}
                <FormHelperText>{t('announcements.backgroundNote')}</FormHelperText>
              </FormControl>

              <Stack direction="row" spacing={1}>
                <Button startIcon={<BackIcon />} onClick={() => navigate('/announcements')}>
                  {t('common.actions.cancel')}
                </Button>
                <Button variant="contained" disabled={!canSave} onClick={save}>
                  {saving ? t('common.messages.saving') : t('common.actions.save')}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Typography variant="h6">{t('announcements.preview.title')}</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            {t('announcements.preview.subtitle')}
          </Typography>
          <AnnouncementCard
            announcement={{
              title: title || t('announcements.preview.untitled'),
              description,
              imageUrl: previewImage,
              imagePlacement: previewImage ? placement : null,
              // Half a link renders as none, here and on the member's page.
              link:
                linkLabel.trim() && linkUrl.trim()
                  ? { label: linkLabel.trim(), url: linkUrl.trim() }
                  : null,
            }}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnnouncementEditorPage;
