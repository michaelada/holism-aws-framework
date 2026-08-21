/** A link shown as a button under a post. */
export interface PostLink {
  label: string;
  url: string;
}

/**
 * An announcement shown on the account and org-admin login pages.
 *
 * `status` and the two surface flags answer different questions: status is
 * whether the post is finished, the flags are where it belongs. A post can be
 * active and shown on neither page — a draft that has been proof-read.
 */
export interface PlatformPost {
  id: string;
  title: string;
  body: string;
  /** A path served by the platform, or null. Never a signed URL. */
  imageUrl: string | null;
  links: PostLink[];
  status: 'active' | 'inactive';
  showOnAccountLogin: boolean;
  showOnOrgadminLogin: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPostInput {
  title: string;
  body: string;
  links: PostLink[];
  status: 'active' | 'inactive';
  showOnAccountLogin: boolean;
  showOnOrgadminLogin: boolean;
}
