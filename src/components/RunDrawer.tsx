// One run, in a side drawer that never navigates away. A modal <dialog>: focus moves in, Esc closes,
// and the page behind can't be clicked. Level 1 is the plain summary; level 2 the steps and raw events.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import type { FeedStatus } from '../lib/feedStatus';
import { formatUtcDay } from '../lib/format';
import { chainText, runChain, runSummary, stepTimeline, type ChainLink, type RunLookup } from '../lib/runDetail';
import { sourceText, type DataSource } from '../lib/source';
import type { Run, StepKind, Workflow } from '../lib/types';
import { numberWord, stepLabel, triggerOf } from '../lib/workflow';
import { NotLiveNote } from './Banners';
import { RunRoute } from './RunRoute';
import { ToneIcon } from './ToneIcon';

interface Props {
  /** The run id in the URL, or null when the drawer is closed. */
  runId: string | null;
  lookup: RunLookup | null;
  serverNow: string | null;
  /** The description of the data the run came from. */
  workflow: Workflow | null;
  status: FeedStatus;
  source: DataSource;
  capturedAt: string;
  onClose: () => void;
  onAll: () => void;
  onRecorded: () => void;
}

const linkClass = 'min-h-11 self-start rounded-sm px-1 text-base text-route underline underline-offset-2';

/** The job's tries as a sentence for screen readers; sighted readers get the drawn route (RunRoute). */
function Chain({ links }: { links: ChainLink[] }) {
  if (links.length === 0) return null;
  return <p className="sr-only">{chainText(links)}.</p>;
}

function StepSection({ run, kind, wf }: { run: Run; kind: StepKind; wf: Workflow }) {
  const rows = stepTimeline(run, kind, wf);
  return (
    <section aria-labelledby={`drawer-${kind}`} className="flex flex-col gap-2">
      <h3 id={`drawer-${kind}`} className="font-display text-md font-semibold">{stepLabel(wf, kind)} timeline</h3>
      <Chain links={runChain(run, kind, wf)} />
      <RunRoute run={run} kind={kind} wf={wf} />
      <ol>
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-t border-glass py-2">
            <span className="font-mono text-sm text-muted" title={r.at}>{r.offset}</span>
            <span className="flex gap-2">
              <ToneIcon tone={r.tone} className="mt-0.5" />
              <span>
                {r.text}
                {r.note !== null && <span className="block text-sm text-muted">{r.note}</span>}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RawEvents({ run }: { run: Run }) {
  return (
    <details className="rounded-sm border border-glass">
      <summary className="flex min-h-11 cursor-pointer items-center px-3 text-base font-medium">Raw events ({run.events.length})</summary>
      <div className="overflow-x-auto border-t border-rule">
        <table className="w-full border-collapse text-left font-mono text-sm">
          <caption className="sr-only">Raw events as Northstar recorded them</caption>
          <thead className="text-muted">
            <tr>
              {['at', 'kind', 'event', 'attempt', 'detail'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-normal">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {run.events.map((e, i) => (
              <tr key={i} className="border-t border-rule">
                <td className="px-3 py-1.5 whitespace-nowrap">{e.at}</td>
                <td className="px-3 py-1.5">{e.kind}</td>
                <td className="px-3 py-1.5">{e.event}</td>
                <td className="px-3 py-1.5">{e.attempt}</td>
                <td className="px-3 py-1.5">{e.detail ?? 'null'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function RunBody({ run, serverNow, wf }: { run: Run; serverNow: string; wf: Workflow }) {
  const s = runSummary(run, serverNow, wf);
  return (
    <>
      <div className="flex flex-col gap-2 rounded-sm bg-raised px-4 py-3.5">
        <p className="text-md">{s.headline}</p>
        {s.lines.map((l) => <p key={l} className="text-base text-muted">{l}</p>)}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {s.facts.map((f) => (
          <div key={f.id} className="flex flex-col gap-0.5 border-t border-glass pt-2">
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="text-base">{f.value}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-route underline underline-offset-2">
          How these are counted
        </summary>
        <dl className="flex flex-col gap-2 pb-1 text-sm">
          {s.facts.map((f) => (
            <div key={f.id}>
              <dt className="inline font-medium">{f.label}: </dt>
              <dd className="inline text-muted">{f.how}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="rounded-sm border border-glass p-3 text-base">
        <b className="font-semibold">Sent once? </b>
        {s.sentOnce.text}
      </p>
      {wf.steps.map((st) => <StepSection key={st.kind} run={run} kind={st.kind} wf={wf} />)}
      <RawEvents run={run} />
    </>
  );
}

export function RunDrawer({ runId, lookup, serverNow, workflow, status, source, capturedAt, onClose, onAll, onRecorded }: Props) {
  const guided = source === 'recording';
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const open = runId !== null;

  // Before paint, so the page never shows a frame with the run id in the URL and no drawer.
  useLayoutEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement ?? document.body;
      d.showModal();
    } else if (!open && opener.current !== null) {
      // Closed by the URL (close button, Back) or already closed natively (Esc).
      if (d.open) d.close();
      // Back to whatever opened it; after a deep link there is none, so the main region.
      const back = opener.current;
      opener.current = null;
      if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
      else document.getElementById('main')?.focus();
    }
  }, [open]);

  // Esc closes the dialog natively; the URL follows. The handler is idempotent (setUrl ignores no-ops).
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onNativeClose = () => onClose();
    d.addEventListener('close', onNativeClose);
    return () => d.removeEventListener('close', onNativeClose);
  }, [onClose]);

  let body: ReactNode = null;
  if (lookup?.kind === 'loading') body = <p aria-busy="true" className="text-base text-muted">Loading the run from Northstar…</p>;
  if (lookup?.kind === 'found' && serverNow !== null && workflow !== null) body = <RunBody run={lookup.run} serverNow={serverNow} wf={workflow} />;
  if (lookup?.kind === 'missing') {
    const why: Record<typeof lookup.reason, string> = {
      recording: 'The recording holds one run only, and this isn’t it.',
      window: 'This run isn’t among the runs created in the selected window.',
      truncated: `This run isn’t among the newest 500 runs ${sourceText(source).thanReturned}.`,
      unknown: 'Northstar has no run with this id.',
      file: 'Your file has no run with this id.',
    };
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-base">{why[lookup.reason]}</p>
        {lookup.reason === 'window' && <button type="button" onClick={onAll} className={linkClass}>Look in all recorded runs</button>}
        {lookup.reason === 'recording' && <button type="button" onClick={onRecorded} className={linkClass}>Open the recorded run</button>}
      </div>
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="run-title"
      // A click on the backdrop lands on the dialog itself, outside the panel.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="run-drawer m-0 ml-auto h-dvh max-h-none w-[min(30rem,100%)] max-w-full overflow-y-auto border-l border-glass bg-panel text-ink"
    >
      {open && (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-3 border-b border-glass pb-4">
            <div className="flex flex-col gap-1">
              <h2 id="run-title" className="font-display text-lg font-semibold">
                Run <span className="font-mono text-md">{runId}</span>
              </h2>
              <p className="text-sm text-muted">{workflow === null ? 'All its jobs' : `One ${triggerOf(workflow).one}'s ${numberWord(workflow.steps.length)} jobs`}, from the first try to the result.</p>
              {source === 'file' && <p className="text-sm font-medium text-route">From your file</p>}
              {guided && (
                <p className="text-sm font-medium text-route">Recorded run, anonymized · frozen {formatUtcDay(capturedAt)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close run details"
              className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-glass hover:border-route"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {source === 'live' && <NotLiveNote status={status} />}
          {body}
        </div>
      )}
    </dialog>
  );
}
