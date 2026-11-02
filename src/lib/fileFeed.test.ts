import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/guided-run.json';
import { FILE_MAX_BYTES, checkFile, readFeedFile } from './fileFeed';

const sampleText = readFileSync(new URL('../../public/sample-feed.json', import.meta.url), 'utf8');
const meta = (text: string, name = 'sample-feed.json') => ({ name, size: text.length });
const read = (text: string, name?: string) => readFeedFile(text, meta(text, name));

describe('loading a file', () => {
  it('reads the sample and the recording, as the live feed would be read', () => {
    const sample = read(sampleText);
    expect(sample.ok && sample.page.runs.length).toBe(8);
    expect(sample.ok && sample.page.workflow.trigger.one).toBe('order');
    const recording = read(JSON.stringify(fixture.page), 'recording.json');
    expect(recording.ok && recording.page.runs[0]?.run_id).toBe('r_6d15828d95f5');
  });

  it('reads an edited sample: a label changed and a run removed', () => {
    const edited = JSON.parse(sampleText) as { workflow: { steps: { label: string }[] }; runs: unknown[] };
    const first = edited.workflow.steps[0];
    if (first) first.label = 'Payment';
    edited.runs = edited.runs.slice(1);
    const r = read(JSON.stringify(edited));
    expect(r.ok && [r.page.workflow.steps[0]?.label, r.page.runs.length]).toEqual(['Payment', 7]);
  });

  it('keeps the file name for the labels', () => {
    const r = read(sampleText, 'my-shop.json');
    expect(r.ok && r.name).toBe('my-shop.json');
  });
});

describe('a file it refuses, with a clear reason', () => {
  it('not a .json name', () => {
    expect(read(sampleText, 'feed.txt')).toEqual({ ok: false, error: 'Choose a .json file.', shape: false });
  });

  it('too big, checked before reading', () => {
    expect(checkFile({ name: 'big.json', size: FILE_MAX_BYTES + 1 })).toBe('This file is 5.0 MB; NEXUS reads files up to 5.0 MB.');
    expect(checkFile({ name: 'big.json', size: 6 * 1024 * 1024 })).toBe('This file is 6.0 MB; NEXUS reads files up to 5.0 MB.');
    expect(checkFile({ name: 'ok.json', size: FILE_MAX_BYTES })).toBeNull();
  });

  it('not valid JSON, with the browser\'s own message', () => {
    const r = read('{"now": ');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/^This isn't valid JSON: .+\.$/);
    expect(!r.ok && r.shape).toBe(false);
  });

  it('more than 500 runs', () => {
    const many = { ...JSON.parse(sampleText) as object, runs: Array.from({ length: 501 }, () => ({})) };
    expect(read(JSON.stringify(many))).toEqual({ ok: false, error: 'This file holds 501 runs; NEXUS reads up to 500.', shape: false });
  });

  it('a missing field, named by its path, the same message as for the live feed', () => {
    const broken = JSON.parse(sampleText) as { runs: { steps: Record<string, unknown>[] }[] };
    delete broken.runs[0]?.steps[1]?.status;
    expect(read(JSON.stringify(broken))).toEqual({
      ok: false, shape: true,
      error: "NEXUS can't read this file: unexpected feed data at runs[0].steps[1].status: expected queued | running | retrying | succeeded | dead.",
    });
  });

  it('a version it does not read', () => {
    const v2 = JSON.parse(sampleText) as { workflow: { version: number } };
    v2.workflow.version = 2;
    expect(read(JSON.stringify(v2))).toEqual({
      ok: false, shape: true, error: "NEXUS can't read this file: this feed describes workflow version 2; NEXUS reads version 1.",
    });
  });
});
