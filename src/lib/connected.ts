// The system NEXUS is connected to right now, as a visitor meets it: its site, and the form that sends it an
// enquiry. The feed describes the jobs; only these few facts about the site itself live here.

export const CONNECTED = {
  name: 'Northstar Digital',
  site: 'https://northstar-demodigital.netlify.app',
  /** The contact form that starts a run. */
  form: 'https://northstar-demodigital.netlify.app/#contact',
  /** The form's own words for its one test switch, so the console can quote what the visitor will see. */
  switchText: 'Simulate an email outage (demo)',
  /** Where its one real delivery goes, said before a visitor sends anything. */
  ownerNote: "The team notification's email really goes to the site's owner.",
} as const;
