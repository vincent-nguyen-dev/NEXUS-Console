// The expanding arrow (step 5.4c, F13) for the landing pages' secondary actions: a route ring with an arrow that
// widens into a pill as the label slides beside it (CSS only, 240 ms). Pointing at it, focusing it, or pointing at
// a card it `stretch`es over opens it; reduced motion shows it open and still. The metal-edged button stays the
// one primary.
import type { ReactNode } from 'react';

interface Props {
  href: string;
  children: ReactNode;
  /** Makes the whole card (the nearest `relative` ancestor) the link's target. */
  stretch?: boolean;
  className?: string;
}

export function ArrowLink({ href, children, stretch = false, className = '' }: Props) {
  return (
    <a href={href} className={`arrow ${stretch ? 'after:absolute after:inset-0 after:rounded-md' : ''} ${className}`}>
      <span aria-hidden="true" className="arrow-ring">→</span>
      {children}
    </a>
  );
}
