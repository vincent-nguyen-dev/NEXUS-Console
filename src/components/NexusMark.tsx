// The NEXUS mark: a line with one pulse, in the route colour. Decorative; the name always stands beside it.
export function NexusMark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" className={`shrink-0 text-route ${className}`}>
      <path d="M2 11h6l3-7v14l3-7h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
