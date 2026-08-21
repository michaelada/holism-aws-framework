import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { getPost } from '../services/postApi';
import type { PlatformPost } from '../types/post.types';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { API_BASE_URL } from '../services/apiBaseUrl';

/**
 * One post, shown roughly as a login page will show it.
 *
 * "Roughly" is honest rather than apologetic: this renders inside the admin
 * theme, and the two login pages have their own. It is here to answer *what
 * does this say* and *where does it go*, which are the questions an operator
 * has before publishing — not to be a pixel preview it cannot truthfully be.
 *
 * The body is sanitised again on the way in. The admin read returns it exactly
 * as written so the editor can round-trip it, which means this screen is the
 * one place in the product that renders unsanitised post HTML — and it is
 * rendered to the only person who could have written it, which is not a reason
 * to skip it.
 */
export const PostDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PlatformPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setPost(await getPost(id));
      } catch (error) {
        setNotFound(true);
        console.error('Error loading post:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const safeBody = useMemo(() => DOMPurify.sanitize(post?.body ?? ''), [post?.body]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !post) {
    return (
      <Box>
        <PageHeader title="Post" onBack={() => navigate('/posts')} backLabel="Posts" />
        <Alert severity="error">That post could not be found.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={post.title}
        onBack={() => navigate('/posts')}
        backLabel="Posts"
        actions={
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/posts/${post.id}/edit`)}
          >
            Edit
          </Button>
        }
      />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <StatusChip status={post.status} />
        {post.showOnAccountLogin && <Chip size="small" variant="outlined" label="Account login" />}
        {post.showOnOrgadminLogin && (
          <Chip size="small" variant="outlined" label="Org admin login" />
        )}
        {!post.showOnAccountLogin && !post.showOnOrgadminLogin && (
          <Chip size="small" variant="outlined" color="warning" label="Not shown on either page" />
        )}
      </Stack>

      <Paper sx={{ p: 0, overflow: 'hidden', maxWidth: 560 }}>
        {post.imageUrl && (
          <Box
            component="img"
            src={`${API_BASE_URL}${post.imageUrl}`}
            alt=""
            sx={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover' }}
          />
        )}
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {post.title}
          </Typography>
          <Box
            sx={{ '& p': { mt: 0, mb: 1 }, '& :last-child': { mb: 0 } }}
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
          {post.links.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              {post.links.map((link) => (
                <Button
                  key={`${link.label}-${link.url}`}
                  size="small"
                  variant="outlined"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Position {post.displayOrder} · last edited {new Date(post.updatedAt).toLocaleString()}
      </Typography>
    </Box>
  );
};

export default PostDetailsPage;
