import React from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { RichText } from '../RichText/RichText';

/** A link shown as a button under a post. */
export interface PostCardLink {
  label: string;
  url: string;
}

export interface PostCardPost {
  id: string;
  title: string;
  /** HTML. Sanitised again by `RichText` before it is rendered. */
  body: string;
  /** A path or absolute URL, or null when the post carries no image. */
  imageUrl: string | null;
  links: PostCardLink[];
}

export interface PostCardProps {
  post: PostCardPost;
  /**
   * Prefixed to a relative `imageUrl`.
   *
   * The API returns a path rather than an absolute URL, so an app served from a
   * different origin to the API — which is every one of them in development —
   * has to say where the API is. Empty when they share an origin.
   */
  imageBaseUrl?: string;
}

/**
 * One platform announcement, as it appears beside a sign-in form.
 *
 * The order is fixed and is the whole design: image, title, message, links.
 * A reader on a login page is not there to read announcements — they are there
 * to sign in — so a post has one chance to be understood while being skimmed
 * past, and that ordering is the one that survives skimming.
 *
 * Rendered by the account application. The Keycloak login themes cannot use
 * this — they are FreeMarker and plain JavaScript, with no React — so they
 * carry their own implementation of the same card, and the two have to be kept
 * in step by hand. That duplication is deliberate and is the price of putting
 * posts on the page that actually holds the password field; see
 * docs/PLATFORM_POSTS.md.
 */
export const PostCard: React.FC<PostCardProps> = ({ post, imageBaseUrl = '' }) => {
  const image = post.imageUrl
    ? /^https?:\/\//i.test(post.imageUrl)
      ? post.imageUrl
      : `${imageBaseUrl}${post.imageUrl}`
    : null;

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        /*
         * A tinted panel rather than white-on-white.
         *
         * These pages have a white background, so a white card with a hairline
         * border barely reads as a card at all — the announcements looked like
         * loose text beside the sign-in form. The values are taken from the
         * org-admin login theme, where the same cards already looked right:
         * a very light warm grey, a softer border, a rounder corner and just
         * enough shadow to lift the card off the page.
         *
         * **Duplicated constants, deliberately.** The Keycloak login themes
         * render this same card in CSS (`resources/css/*.css`, `.ips-post`) and
         * cannot read a MUI theme, so these four values exist twice and have to
         * be changed together. See docs/PLATFORM_POSTS.md.
         */
        backgroundColor: '#faf8f5',
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {image && (
        <Box
          component="img"
          src={image}
          /*
           * Deliberately empty. The image illustrates a post whose title and
           * body are right beside it in the same card, so a screen reader
           * announcing a description would repeat what it is about to read
           * anyway. An operator uploading a picture has nowhere to write alt
           * text, and inventing one from the title would be worse than silence.
           */
          alt=""
          sx={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
          }}
        />
      )}
      <CardContent>
        <Typography variant="h6" component="h3" gutterBottom>
          {post.title}
        </Typography>

        <RichText html={post.body} sx={{ color: 'text.secondary' }} />

        {post.links.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            {post.links.map((link) => (
              <Button
                key={`${link.label}-${link.url}`}
                size="small"
                variant="outlined"
                href={link.url}
                /*
                 * A new tab, and `noopener` with it. These links leave the
                 * platform from a page the reader has not signed in on yet, and
                 * taking the tab with them would lose a half-typed sign-in.
                 */
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </Button>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default PostCard;
