import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getPost,
  updatePost,
  uploadPostImage,
  deletePostImage,
} from '../services/postApi';
import type { PlatformPost } from '../types/post.types';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';
import { PostForm, PostFormValues } from '../components/PostForm';

export const EditPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PlatformPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

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

  const submit = async (values: PostFormValues, image: File | null, removeImage: boolean) => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updatePost(id, values);

      /*
       * The image is a separate call, and the two are not interchangeable:
       * choosing a replacement supersedes a removal, so an author who removes
       * an image and then picks another gets the one they picked.
       */
      if (image) {
        await uploadPostImage(id, image);
      } else if (removeImage) {
        await deletePostImage(id);
      }

      showSuccess(`"${updated.title}" saved`);
      navigate('/posts');
    } catch (error: any) {
      showError(error?.response?.data?.error ?? 'Failed to save the post');
      console.error('Error updating post:', error);
    } finally {
      setSaving(false);
    }
  };

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
        title="Edit post"
        description={post.title}
        onBack={() => navigate('/posts')}
        backLabel="Posts"
      />
      <PostForm
        initial={post}
        saving={saving}
        onSubmit={submit}
        onCancel={() => navigate('/posts')}
        submitLabel="Save changes"
      />
    </Box>
  );
};

export default EditPostPage;
