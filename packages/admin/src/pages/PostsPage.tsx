import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDownward as DownIcon,
  ArrowUpward as UpIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getPosts, deletePost, reorderPosts } from '../services/postApi';
import type { PlatformPost } from '../types/post.types';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { API_BASE_URL } from '../services/apiBaseUrl';

/**
 * The posts shown on both login pages, in the order they appear there.
 *
 * A plain ordered list rather than the sortable `AdminTable` the other screens
 * use, because here the order *is* the content: a table that can be re-sorted
 * by title would show an arrangement that is not the one being edited, and the
 * position of a row would stop meaning anything.
 *
 * Reordering is a pair of arrows per row rather than drag-and-drop. It is
 * keyboard-reachable and screen-reader-legible without any of the machinery
 * drag needs, and the list is short enough that a drag would rarely be the
 * faster thing anyway.
 */
export const PostsPage: React.FC = () => {
  const [posts, setPosts] = useState<PlatformPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlatformPost | null>(null);
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      setPosts(await getPosts());
    } catch (error) {
      setLoadFailed(true);
      showError('Failed to load posts');
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Move one post, and save the whole arrangement.
   *
   * Optimistic: the list is redrawn before the server answers, because the
   * alternative is a row that visibly lags the arrow that moved it. A failure
   * reloads from the server rather than trying to undo the move — the server's
   * answer is the one that matters, and guessing at a rollback can leave the
   * screen disagreeing with it.
   */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= posts.length) return;

    const next = [...posts];
    [next[index], next[target]] = [next[target], next[index]];
    setPosts(next);
    setReordering(true);

    try {
      setPosts(await reorderPosts(next.map((post) => post.id)));
    } catch (error) {
      showError('Failed to save the new order');
      console.error('Error reordering posts:', error);
      await load();
    } finally {
      setReordering(false);
    }
  };

  const remove = async (post: PlatformPost) => {
    try {
      await deletePost(post.id);
      showSuccess(`"${post.title}" deleted`);
      setConfirmDelete(null);
      await load();
    } catch (error) {
      showError('Failed to delete the post');
      console.error('Error deleting post:', error);
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
    <Box>
      <PageHeader
        title="Posts"
        description="Announcements shown on the account and org admin login pages, in the order they appear."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/posts/new')}>
            New post
          </Button>
        }
      />

      {loadFailed && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={load}>Retry</Button>}>
          The posts could not be loaded.
        </Alert>
      )}

      {!loadFailed && posts.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" gutterBottom>
            No posts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A post appears beside the sign-in form on the account and org admin login pages.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/posts/new')}>
            Write the first one
          </Button>
        </Paper>
      )}

      <Stack spacing={1}>
        {posts.map((post, index) => (
          <Paper key={post.id} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Stack>
                <IconButton
                  size="small"
                  aria-label={`Move "${post.title}" up`}
                  disabled={index === 0 || reordering}
                  onClick={() => move(index, -1)}
                >
                  <UpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move "${post.title}" down`}
                  disabled={index === posts.length - 1 || reordering}
                  onClick={() => move(index, 1)}
                >
                  <DownIcon fontSize="small" />
                </IconButton>
              </Stack>

              {post.imageUrl ? (
                <Box
                  component="img"
                  src={`${API_BASE_URL}${post.imageUrl}`}
                  alt=""
                  sx={{
                    width: 72,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 1,
                    flexShrink: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              ) : (
                <Box sx={{ width: 72, flexShrink: 0 }} />
              )}

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap title={post.title}>
                  {post.title}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                  <StatusChip status={post.status} />
                  {/*
                    Where it appears, said plainly. "Active" alone does not
                    answer the question an operator is actually asking, which is
                    whether anyone is seeing this.
                  */}
                  {post.showOnAccountLogin && (
                    <Chip size="small" variant="outlined" label="Account login" />
                  )}
                  {post.showOnOrgadminLogin && (
                    <Chip size="small" variant="outlined" label="Org admin login" />
                  )}
                  {!post.showOnAccountLogin && !post.showOnOrgadminLogin && (
                    <Chip size="small" variant="outlined" color="warning" label="Not shown" />
                  )}
                  {post.links.length > 0 && (
                    <Tooltip title={post.links.map((link) => link.label).join(', ')}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${post.links.length} link${post.links.length === 1 ? '' : 's'}`}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              <Stack direction="row" spacing={0.5}>
                <Tooltip title="View">
                  <IconButton
                    aria-label={`View "${post.title}"`}
                    onClick={() => navigate(`/posts/${post.id}`)}
                  >
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    aria-label={`Edit "${post.title}"`}
                    onClick={() => navigate(`/posts/${post.id}/edit`)}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    aria-label={`Delete "${post.title}"`}
                    onClick={() => setConfirmDelete(post)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete this post?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{confirmDelete?.title}" will be removed from every login page it appears on. This
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => confirmDelete && remove(confirmDelete)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PostsPage;
