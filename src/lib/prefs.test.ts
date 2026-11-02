import { describe, expect, it } from 'vitest';
import { introDismissed, setIntroDismissed, type PrefStorage } from './prefs';

function memory(): PrefStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const broken: PrefStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('intro preference', () => {
  it('is not dismissed by default', () => {
    expect(introDismissed(memory())).toBe(false);
  });

  it('reads back what was set', () => {
    const s = memory();
    setIntroDismissed(s, true);
    expect(introDismissed(s)).toBe(true);
    setIntroDismissed(s, false);
    expect(introDismissed(s)).toBe(false);
  });

  it('a storage that throws shows the intro and does not crash', () => {
    expect(() => setIntroDismissed(broken, true)).not.toThrow();
    expect(introDismissed(broken)).toBe(false);
  });

  it('no storage at all shows the intro', () => {
    expect(introDismissed(null)).toBe(false);
    expect(() => setIntroDismissed(null, true)).not.toThrow();
  });
});
