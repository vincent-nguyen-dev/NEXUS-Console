// Per-viewer conveniences kept in browser storage. Storage can be missing or throw (private
// windows, blocked site data), so every read and write falls back to the default.

export type PrefStorage = Pick<Storage, 'getItem' | 'setItem'>;

const INTRO_KEY = 'nexus.intro.dismissed';

export function introDismissed(storage: PrefStorage | null): boolean {
  try {
    return storage?.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIntroDismissed(storage: PrefStorage | null, dismissed: boolean): void {
  try {
    storage?.setItem(INTRO_KEY, dismissed ? '1' : '0');
  } catch {
    // Not remembered; the intro shows again next visit.
  }
}
