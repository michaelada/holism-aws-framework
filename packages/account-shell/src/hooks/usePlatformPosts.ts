import { useEffect, useState } from 'react';
import { useAccountApi } from './useAccountApi';
import type { PostCardPost } from '@itsplainsailing/components';

/**
 * The platform's announcements for one login surface.
 *
 * Anonymous by nature: this runs on a page whose entire purpose is that the
 * visitor has not signed in yet.
 *
 * **It never surfaces an error.** A failure resolves to an empty list, so the
 * announcements panel simply is not there. That is deliberate rather than lazy:
 * nobody on this page can report a broken panel, and an error state beside a
 * sign-in form would suggest the sign-in itself is broken — which would stop
 * people trying, over a decorative failure.
 */
export function usePlatformPosts(surface: 'account' | 'orgadmin') {
  const { execute } = useAccountApi<PostCardPost[]>();
  const [posts, setPosts] = useState<PostCardPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await execute({
          url: `/api/public/posts?surface=${surface}`,
          anonymous: true,
        });
        if (!cancelled) setPosts(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [execute, surface]);

  return { posts, loading };
}

export default usePlatformPosts;
