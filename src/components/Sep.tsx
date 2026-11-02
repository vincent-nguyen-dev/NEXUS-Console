// A pause between two pieces of text that sit apart on screen but touch in the markup (step 7.1b, F16). A screen
// reader joins adjacent spans without a space ("NEXUSWorkflow operations console"); the hidden text gives it a
// pause. The plain space is for checks that read only visible text (axe's "label in name"); between flex items it
// isn't drawn, and the hidden span is absolutely positioned, so neither takes a gap.
export function Sep({ text = ', ' }: { text?: string }) {
  return <>{' '}<span className="sr-only">{text}</span></>;
}
