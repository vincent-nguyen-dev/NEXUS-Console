// Every recorded event of the window's runs, filtered and sorted by the URL. A row opens its run. Rows of one run
// read as a block (step 5.2b, board D4): a stronger line where the run changes, faint lines inside it.
import { useMemo, useRef, useState } from 'react';
import { useKeepFocus } from '../hooks/useKeepFocus';
import { eventRows, filterRows, runBlocks, sortRows, type Order } from '../lib/filters';
import { eventDetail, eventLabel, eventTone, formatDuration, formatUtcTime, uniquePrefixes } from '../lib/format';
import { EVENT_TYPES, type EventType, type Run, type StepKind, type Workflow } from '../lib/types';
import { stepLabel } from '../lib/workflow';
import { MAX_ATTEMPT } from '../lib/urlState';
import { ToneIcon } from './ToneIcon';

export const PAGE_ROWS = 100;

export interface TableFilter {
  step: StepKind | null;
  attempt: number | null;
  event: EventType | null;
  order: Order;
}

interface Props {
  runs: Run[];
  workflow: Workflow;
  filter: TableFilter;
  onFilter: (patch: Partial<TableFilter>) => void;
  onOpenRun: (runId: string) => void;
  /** Says which runs the rows come from, e.g. "runs created in the last 30 days". */
  scope: string;
  /** "+" when the window holds more runs than Northstar returned. */
  more: string;
}

const EVENT_OPTION: Record<EventType, string> = {
  queued: 'Queued or scheduled', started: 'Started', failed: 'Failed', retry_scheduled: 'Retry planned', succeeded: 'Succeeded', dead: 'Gave up',
};
const selectClass = 'min-h-11 min-w-44 rounded-sm border border-glass bg-panel px-3 text-base text-ink hover:border-route disabled:cursor-not-allowed disabled:text-muted disabled:hover:border-glass';
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Filters({ filter, onFilter, workflow }: Pick<Props, 'filter' | 'onFilter' | 'workflow'>) {
  const active = filter.step !== null || filter.event !== null;
  // As many tries as the chosen job allows, or the most any job allows (the description says; up to the contract's limit).
  const chosen = workflow.steps.find((s) => s.kind === filter.step);
  const tries = Math.min(MAX_ATTEMPT, chosen?.max_attempts ?? Math.max(1, ...workflow.steps.map((s) => s.max_attempts)));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        Job
        <select
          className={selectClass}
          value={filter.step ?? ''}
          onChange={(e) => onFilter({ step: (e.target.value || null) as StepKind | null, attempt: null })}
        >
          <option value="">All jobs</option>
          {workflow.steps.map((s) => <option key={s.kind} value={s.kind}>{s.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Try
        <select
          className={selectClass}
          value={filter.attempt ?? ''}
          disabled={filter.step === null}
          onChange={(e) => onFilter({ attempt: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">{filter.step === null ? 'Choose a job first' : 'Any try'}</option>
          {Array.from({ length: tries }, (_, i) => i + 1).map((a) => <option key={a} value={a}>Try {a}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Event
        <select
          className={selectClass}
          value={filter.event ?? ''}
          onChange={(e) => onFilter({ event: (e.target.value || null) as EventType | null })}
        >
          <option value="">All events</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_OPTION[t]}</option>)}
        </select>
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onFilter({ step: null, attempt: null, event: null })}
          className="min-h-11 rounded-sm px-2 text-base text-route underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function EventTable({ runs, workflow, filter, onFilter, onOpenRun, scope, more }: Props) {
  const all = useMemo(() => eventRows(runs), [runs]);
  const prefixes = useMemo(() => uniquePrefixes(runs.map((r) => r.run_id)), [runs]);
  const rows = useMemo(
    () => sortRows(filterRows(all, { step: filter.step, attempt: filter.attempt, event: filter.event }), filter.order),
    [all, filter.step, filter.attempt, filter.event, filter.order],
  );
  // Back to the first page whenever the filters or the sort change (adjusted during render, not in an effect).
  const filterKey = `${filter.step}|${filter.attempt}|${filter.event}|${filter.order}`;
  const [paging, setPaging] = useState({ key: filterKey, limit: PAGE_ROWS });
  if (paging.key !== filterKey) setPaging({ key: filterKey, limit: PAGE_ROWS });
  const limit = paging.key === filterKey ? paging.limit : PAGE_ROWS;
  const shown = rows.slice(0, limit);
  const starts = runBlocks(shown);
  const left = rows.length - shown.length;

  const count = rows.length === all.length
    ? `${plural(all.length, 'event', 'events')}${more} from ${plural(runs.length, 'run', 'runs')}${more} ${scope}.`
    : `${rows.length} of ${all.length}${more} events from ${plural(runs.length, 'run', 'runs')}${more} ${scope}.`;
  const newest = filter.order === 'newest';
  // Clear filters goes away once pressed: focus moves to the first filter (7.1c, F6).
  const section = useRef<HTMLElement>(null);
  useKeepFocus(() => section.current?.querySelector('select') ?? null, section);
  const table = useRef<HTMLDivElement>(null);
  const showMore = () => {
    const first = limit;
    setPaging({ key: filterKey, limit: limit + PAGE_ROWS });
    // The first row it adds (or the first after it with a run id) takes the focus, so the keyboard is where the new rows are.
    requestAnimationFrame(() => {
      const rows = [...(table.current?.querySelectorAll('tbody tr') ?? [])].slice(first);
      rows.map((r) => r.querySelector('button')).find((b) => b !== null)?.focus();
    });
  };
  // What's announced: the count as of the last filter change (adjusted during render, like the paging above).
  const [said, setSaid] = useState({ key: filterKey, text: '' });
  if (said.key !== filterKey) setSaid({ key: filterKey, text: count });

  return (
    <section ref={section} aria-labelledby="events-title" className="flex flex-col gap-4">
      <h2 id="events-title" className="sr-only">Events</h2>
      <Filters workflow={workflow} filter={filter} onFilter={onFilter} />
      <p className="text-base">{count}</p>
      <p className="sr-only" aria-live="polite">{said.key === filterKey ? said.text : count}</p>
      {rows.length === 0 ? (
        <p className="rounded-md border border-glass bg-panel p-4 text-base text-muted">No events match these filters.</p>
      ) : (
        <div ref={table} role="region" aria-label="Events table (scrolls sideways on narrow screens)" tabIndex={0} className="overflow-x-auto rounded-md border border-glass bg-panel">
          <table className="w-full min-w-[56rem] border-collapse text-left text-base">
            <caption className="sr-only">Events, {newest ? 'newest' : 'oldest'} first. Each run id opens that run's details.</caption>
            <thead className="text-sm text-muted">
              <tr className="border-b border-rule">
                <th scope="col" aria-sort={newest ? 'descending' : 'ascending'} className="px-3 py-1 font-medium">
                  <button
                    type="button"
                    onClick={() => onFilter({ order: newest ? 'oldest' : 'newest' })}
                    className="flex min-h-11 items-center gap-1 text-left font-medium text-ink underline underline-offset-2"
                  >
                    Time (UTC) <span aria-hidden="true">{newest ? '↓' : '↑'}</span>
                    <span className="sr-only">, {newest ? 'newest' : 'oldest'} first. Click for {newest ? 'oldest' : 'newest'} first.</span>
                  </button>
                </th>
                <th scope="col" className="px-3 py-1 font-medium">Run</th>
                <th scope="col" className="px-3 py-1 font-medium">Job</th>
                <th scope="col" className="px-3 py-1 font-medium">Event</th>
                <th scope="col" className="px-3 py-1 font-medium">Try</th>
                <th scope="col" className="px-3 py-1 font-medium">Detail</th>
                <th scope="col" className="px-3 py-1 font-medium">Since previous<span className="block font-normal">same run and job</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const d = eventDetail(workflow, r.kind, r.event, r.detail);
                const first = starts[i] === true;
                return (
                  <tr
                    key={`${r.runId}|${r.kind}|${r.event}|${r.attempt}|${r.at}`}
                    onClick={() => onOpenRun(r.runId)}
                    className={`cursor-pointer hover:bg-raised ${first ? 'border-t-2 border-track' : 'border-t border-glass'}`}
                  >
                    <td className="px-3 py-2 font-mono text-sm whitespace-nowrap text-muted" title={r.at}>{formatUtcTime(r.at)}</td>
                    <td className="px-3 py-1">
                      <button
                        type="button"
                        aria-label={`Open run ${prefixes.get(r.runId) ?? r.runId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRun(r.runId);
                        }}
                        className={`min-h-11 rounded-sm px-1 font-mono text-sm ${first ? 'text-route underline underline-offset-2' : 'text-muted hover:text-route'}`}
                      >
                        {prefixes.get(r.runId)}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{stepLabel(workflow, r.kind)}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <ToneIcon tone={eventTone(r, workflow)} />
                        {eventLabel(workflow, r.kind, r.event)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-sm">{r.attempt === 0 ? '—' : r.attempt}</td>
                    <td className="px-3 py-2">
                      {d.code === null && d.gloss === null && <span className="text-muted">—</span>}
                      {d.code !== null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-glass bg-bg px-2.5 whitespace-nowrap">
                          <span className="font-mono text-sm">{d.code}</span>
                          {d.gloss !== null && <span className="text-sm text-muted">{d.gloss}</span>}
                        </span>
                      )}
                      {d.code === null && d.gloss !== null && <span className="text-sm text-muted">{d.gloss}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-sm whitespace-nowrap">{r.waitS === null ? <span className="text-muted">—</span> : formatDuration(r.waitS)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {left > 0 && (
        <div>
          <button
            type="button"
            onClick={showMore}
            className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium"
          >
            Show {Math.min(PAGE_ROWS, left)} more ({left} left)
          </button>
        </div>
      )}
    </section>
  );
}
