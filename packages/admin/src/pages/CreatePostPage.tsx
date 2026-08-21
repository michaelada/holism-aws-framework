import React, { useState } from 'react';
import { Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { createPost, uploadPostImage } from '../services/postApi';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';
import { PostForm, PostFormValues } from '../components/PostForm';

/**
 * Writing a new post.
 *
 * The image is uploaded *after* the post is created, because the upload route
 * is addressed by post id and there is no id until the row exists. That
 * ordering has a consequence worth being honest about: a post whose image
 * upload fails is still created, so the operator is told the post was saved and
 * the image was not, and lands on the edit screen where they can try again —
 * rather than being shown a failure for something that half-succeeded.
 */
export const CreatePostPage: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();

  const submit = async (values: PostFormValues, image: File | null) => {
    setSaving(true);
    try {
      const post = await createPost(values);

      if (image) {
        try {
          await uploadPostImage(post.id, image);
        } catch (error) {
          console.error('Error uploading post image:', error);
          showError('The post was created, but the image could not be uploaded');
          navigate(`/posts/${post.id}/edit`);
          return;
        }
      }

      showSuccess(`"${post.title}" created`);
      navigate('/posts');
    } catch (error: any) {
      showError(error?.response?.data?.error ?? 'Failed to create the post');
      console.error('Error creating post:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="New post"
        description="Shown beside the sign-in form on the login pages you choose."
        onBack={() => navigate('/posts')}
        backLabel="Posts"
      />
      <PostForm
        saving={saving}
        onSubmit={submit}
        onCancel={() => navigate('/posts')}
        submitLabel="Create post"
      />
    </Box>
  );
};

export default CreatePostPage;
