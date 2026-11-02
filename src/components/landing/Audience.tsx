// Who NEXUS is for, in their own terms.
const CARDS = [
  {
    title: 'A business whose website sends emails',
    text: "You can't fix what nobody tells you about. See whether every enquiry's email went out, and only once, without checking an inbox.",
  },
  {
    title: 'An agency running sites for clients',
    text: 'One place to see which client site had a failing job this week, and to show the client it recovered.',
  },
  {
    title: 'A team with scheduled scripts',
    text: 'Nightly imports, reports, clean-ups. See what ran, what retried, and what gave up, with the reason.',
  },
];

export function Audience() {
  return (
    <section aria-labelledby="audience-title" className="flex flex-col gap-7 pb-24">
      <h2 id="audience-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">Who it&apos;s for</h2>
      <ul className="grid gap-4 min-[720px]:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.title} className="flex flex-col gap-2.5 rounded-md bg-panel px-7 py-7">
            <h3 className="font-display text-2xl leading-tight font-semibold">{c.title}</h3>
            <p className="text-md">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
