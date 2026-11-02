// The band that closes every landing page (step 5.4c, S8, boards F-1 and F-3): one question, one line, the
// metal-edged "Get in touch" (it leans toward the pointer: `useMagnet`), and the email address as selectable text
// with a Copy button, because a mailto link opens nothing on a machine without a mail app. Home and /how also point
// to what I can build (/work); /work says what happens after you write (checkpoint B, ChatGPT 9).
import { useEffect, useRef, useState } from 'react';
import { CREDITS, mailtoHref } from '../../lib/credits';
import { WORK_PATH } from '../../lib/routes';
import { useMagnet } from '../../hooks/useMagnet';
import { ArrowLink } from './ArrowLink';

const COPIED_MS = 2400;

function CopyEmail() {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const addr = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CREDITS.email);
      setState('copied');
    } catch {
      // A refused clipboard: the address, selected, for Ctrl+C.
      const el = addr.current;
      const sel = window.getSelection();
      if (el && sel) {
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setState('selected');
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
      <span ref={addr} className="font-mono text-sm break-all">{CREDITS.email}</span>
      <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-glass px-3 text-sm hover:border-route">
        {state === 'copied' && (
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round" /></svg>
        )}
        {state === 'copied' ? 'Copied' : state === 'selected' ? 'Selected: press Ctrl+C' : 'Copy'}
        <span className="sr-only">{state === 'idle' ? ' the email address' : ''}</span>
      </button>
      <span role="status" className="sr-only">{state === 'copied' ? 'Copied the email address' : state === 'selected' ? 'The email address is selected: press Ctrl+C to copy it' : ''}</span>
    </span>
  );
}

export function CtaBand({ line, workLink, after }: { line: string; workLink: boolean; after?: string }) {
  const { area, target } = useMagnet<HTMLElement, HTMLSpanElement>();
  return (
    <section ref={area} aria-labelledby="cta-title" className="relative isolate mb-24 overflow-hidden rounded-md border border-glass bg-bg px-5 py-14 min-[720px]:px-14 min-[720px]:py-16">
      <div aria-hidden="true" className="cta-grid" />
      <div className="flex flex-col items-center gap-4.5 text-center">
        <h2 id="cta-title" className="font-display text-xl font-semibold text-balance min-[720px]:text-5xl">Want this for your background jobs?</h2>
        <p className="max-w-[60ch] text-reading text-muted">{line}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5.5 gap-y-4">
          <span ref={target} className="metal magnet">
            <a href={mailtoHref} className="btn-primary inline-flex min-h-13 items-center rounded-sm bg-route px-6 text-md font-semibold text-bg">
              Get in touch
            </a>
          </span>
          <CopyEmail />
        </div>
        {after !== undefined && <p className="max-w-[52ch] text-base text-muted">{after}</p>}
        {workLink && <ArrowLink href={WORK_PATH} className="mt-2">What I can build</ArrowLink>}
      </div>
    </section>
  );
}
