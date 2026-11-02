// Who built NEXUS and how to reach them: the one source for the footer, the rail and the README.
// NEXUS is a portfolio project; saying so is honest and tells a visitor why it exists.

export const SITE_URL = 'https://nexus-democonsole.netlify.app/';

export const CREDITS = {
  name: 'Vincent Nguyen',
  pitch: 'available for freelance web development, AI integration and automation',
  email: 'vincent.cao.nguyen.work@gmail.com',
  github: 'https://github.com/vincent-nguyen-dev',
} as const;

/** NEXUS's own source (the README explains the build). */
export const REPO_URL = `${CREDITS.github}/NEXUS-Console`;

/**
 * Whether the repo can be opened. While it's private, a link to it 404s, so the pages say "private for now"
 * instead of showing a link that looks live. The owner flips this when the repo goes public.
 */
export const REPO_PUBLIC = false;

/** The repo's address when it can be opened, or null. */
export const repoLink = (isPublic: boolean = REPO_PUBLIC): string | null => (isPublic ? REPO_URL : null);

/** Opens the visitor's mail app with a subject, and nothing else in the link. */
export const mailtoHref = `mailto:${CREDITS.email}?subject=${encodeURIComponent('NEXUS enquiry')}`;
