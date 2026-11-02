// The run strip: one chip per run, oldest left → newest right, the same runs the map counts (runStory.ts). Hover
// or focus previews a run's path on the map; click, tap or Enter pins it (and again unpins it). One tab stop:
// the arrow keys move between chips.
import { useRef, useState, type KeyboardEvent } from 'react';
import { formatUtcMinute } from '../../lib/format';
import { runStory, stripRuns } from '../../lib/runStory';
import type { Run, Workflow } from '../../lib/types';
import { StoryShape } from './StoryShape';

interface Props {
  runs: Run[];
  workflow: Workflow;
  prefixes: Map<string, string>;
  pinned: string | null;
  onPin: (runId: string | null) => void;
  onPreview: (runId: string | null) => void;
}

export function RunStrip({ runs, workflow, prefixes, pinned, onPin, onPreview }: Props) {
  const strip = stripRuns(runs);
  const ids = strip.runs.map((r) => r.run_id);
  const [focusId, setFocusId] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // The tab stop: the focused chip, else the pinned one, else the newest. A chip that left the data hands it on.
  const stop = [focusId, pinned].find((id) => id !== null && ids.includes(id)) ?? ids.at(-1) ?? null;

  const move = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const i = ids.indexOf(id);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(ids.length - 1, i + 1);
    if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = ids.length - 1;
    if (e.key === 'Escape' && pinned !== null) {
      e.preventDefault();
      onPin(null);
      return;
    }
    if (next === null) return;
    e.preventDefault();
    const to = ids[next];
    if (to !== undefined) buttons.current.get(to)?.focus();
  };

  if (strip.runs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{strip.label} Pick one to trace its path.</p>
      <div role="toolbar" aria-label="Runs, oldest to newest" className="flex flex-wrap" onMouseLeave={() => onPreview(null)}>
        {strip.runs.map((run) => {
          const story = runStory(run, workflow);
          const on = pinned === run.run_id;
          return (
            <button
              key={run.run_id}
              ref={(el) => {
                if (el) buttons.current.set(run.run_id, el);
                else buttons.current.delete(run.run_id);
              }}
              type="button"
              tabIndex={run.run_id === stop ? 0 : -1}
              aria-pressed={on}
              aria-label={`Run ${prefixes.get(run.run_id) ?? run.run_id}, ${formatUtcMinute(run.created_at)}: ${story.text}.`}
              title={`Run ${prefixes.get(run.run_id) ?? ''}: ${story.text}`}
              onClick={() => onPin(on ? null : run.run_id)}
              onMouseEnter={() => onPreview(run.run_id)}
              onFocus={() => {
                setFocusId(run.run_id);
                onPreview(run.run_id);
              }}
              onBlur={() => onPreview(null)}
              onKeyDown={(e) => move(e, run.run_id)}
              className="flex size-11 items-center justify-center rounded-full aria-pressed:ring-2 aria-pressed:ring-inset aria-pressed:ring-route"
            >
              <StoryShape kind={story.kind} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
