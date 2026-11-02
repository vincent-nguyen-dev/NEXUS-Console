// "Your file": load a JSON file in the feed's shape and the console draws it. It's read in this tab and
// nothing else: no upload, no storage, and a reload clears it. The drop zone wraps a native file input, so
// keyboards and screen readers get the browser's own file picker.
import { useId, useState, type DragEvent } from 'react';
import { checkFile, readFeedFile, type FileRead } from '../lib/fileFeed';
import { CONNECT_PATH } from '../lib/routes';
import { useKeepFocus } from '../hooks/useKeepFocus';

export const SAMPLE_HREF = '/sample-feed.json';
/** How the sample is named on screen when it's opened with one click, so it never reads as the visitor's own. */
export const SAMPLE_NAME = 'the made-up shop sample';

/**
 * The sample, read with the same checks as any file. It comes from NEXUS's own site (same origin):
 * nothing is sent anywhere.
 */
export async function loadSample(): Promise<FileRead> {
  try {
    const res = await fetch(SAMPLE_HREF);
    const text = await res.text();
    const read = readFeedFile(text, { name: 'sample-feed.json', size: text.length });
    return read.ok ? { ...read, name: SAMPLE_NAME } : read;
  } catch {
    return { ok: false, error: "The sample couldn't be loaded. Try again, or download it below.", shape: false };
  }
}

interface Props {
  onLoad: (read: Extract<FileRead, { ok: true }>) => void;
  /** Shown when the console was opened in file mode without a file (a reload, a shared link). */
  reloaded: boolean;
}

export function FileLoader({ onLoad, reloaded }: Props) {
  const inputId = useId();
  const [error, setError] = useState<{ text: string; shape: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    const early = checkFile({ name: file.name, size: file.size });
    if (early !== null) {
      setError({ text: early, shape: false });
      return;
    }
    setBusy(true);
    const read = readFeedFile(await file.text(), { name: file.name, size: file.size });
    setBusy(false);
    if (read.ok) {
      setError(null);
      onLoad(read);
    } else {
      setError({ text: read.error, shape: read.shape });
    }
  };

  const sample = async () => {
    setBusy(true);
    const read = await loadSample();
    setBusy(false);
    if (read.ok) {
      setError(null);
      onLoad(read);
    } else {
      setError({ text: read.error, shape: false });
    }
  };

  // Once a file loads, the loader goes: focus moves to the page's main area (7.1c, F6).
  const panel = useKeepFocus<HTMLElement>(() => document.getElementById('main'));

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <section ref={panel} aria-labelledby="loader-title" className="flex flex-col gap-5 rounded-md bg-panel p-6 min-[720px]:p-8">
      <div className="flex max-w-[70ch] flex-col gap-2">
        <h2 id="loader-title" tabIndex={-1} className="font-display text-2xl font-semibold outline-none">Load your own file</h2>
        <p className="text-reading">
          A JSON file in the feed&apos;s shape (every field is on <a href={CONNECT_PATH} className="text-route underline underline-offset-2">Connect your system</a>):
          the console draws it as it draws Northstar.
        </p>
        {reloaded && <p className="text-base text-muted">Reloading clears your file, so load it again.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-raised p-5">
        <p className="text-base">
          <b className="font-semibold">No file yet?</b> See NEXUS draw a made-up shop instead of Northstar. Nothing to download or edit.
        </p>
        <button type="button" onClick={() => void sample()} disabled={busy} className="inline-flex min-h-11 items-center self-start rounded-sm bg-route px-5 text-base font-semibold text-bg disabled:opacity-60">
          See the sample
        </button>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center focus-within:outline-2 focus-within:outline-route ${over ? 'border-route bg-raised' : 'border-track'}`}
      >
        <span className="text-md font-semibold text-route">{busy ? 'Reading…' : 'Choose a file'}</span>
        <span className="text-base text-muted">or drop it here</span>
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>

      <div aria-live="polite">
        {error !== null && (
          <div className="flex flex-col gap-1.5 rounded-md border border-dead/60 p-4">
            <p className="text-base">{error.text}</p>
            {error.shape && (
              <a href={`${CONNECT_PATH}#fields`} className="self-start text-base text-route underline underline-offset-2">
                Every field and rule
              </a>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <a href={SAMPLE_HREF} download="sample-feed.json" className="inline-flex min-h-11 items-center rounded-sm bg-raised px-5 text-base font-semibold hover:bg-rule">
            Download a sample to edit
          </a>
          <a href={`${CONNECT_PATH}#try`} className="inline-flex min-h-11 items-center text-base text-route underline underline-offset-2">
            How to change it in three edits
          </a>
        </span>
        <p className="text-sm text-muted">Stays in this tab · nothing is uploaded · reloading clears it</p>
      </div>
    </section>
  );
}
