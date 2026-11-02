// One of the story's questions as a radio group (the 06 quiz's control, extracted). Answering is optional.
import { QUESTIONS, type QuestionId } from '../../lib/story';

export function Question({ id, value, onChange }: { id: QuestionId; value: string | undefined; onChange: (value: string) => void }) {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) return null;
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-reading font-medium">{q.text}</legend>
      <div className="flex flex-wrap gap-2">
        {q.choices.map((c) => (
          <label
            key={c.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-rule bg-panel px-3.5 text-base has-checked:border-route has-checked:bg-raised"
          >
            <input type="radio" name={q.id} value={c.value} checked={value === c.value} onChange={() => onChange(c.value)} className="accent-route" />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
