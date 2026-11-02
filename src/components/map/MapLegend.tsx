// The map's key: what each line and shape means (the wide map; also the bento on /how). Every outcome has a
// shape as well as a colour.
import { ToneIcon } from '../ToneIcon';
import { StoryShape } from './StoryShape';

export function MapLegend() {
  const line = (stroke: string, dash?: string) => (
    <svg width="28" height="8" aria-hidden="true"><path d="M0 4H28" stroke={stroke} strokeWidth={dash ? 3 : 4} strokeDasharray={dash} /></svg>
  );
  const item = 'flex items-center gap-2';
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-3 text-sm text-muted">
      <li className={item}>{line('var(--color-route)')}path runs took</li>
      <li className={item}>{line('var(--color-retry)', '7 5')}wait before the next try</li>
      <li className={item}><StoryShape kind="sent" size={20} />sent</li>
      <li className={item}><StoryShape kind="recovered" size={20} />sent after failed tries</li>
      <li className={item}><StoryShape kind="simulated" size={20} />simulated, nothing sent</li>
      <li className={item}><StoryShape kind="waiting" size={20} />failed, tried again</li>
      <li className={item}><ToneIcon tone="noresult" />never reported back</li>
      <li className={item}><StoryShape kind="gaveup" size={20} />gave up</li>
      <li className={item}><StoryShape kind="scheduled" size={20} />scheduled</li>
    </ul>
  );
}
