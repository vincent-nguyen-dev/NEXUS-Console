// Who built NEXUS: the top of /work, so its title is the page's h1. The usability gate read NEXUS as a product to buy,
// so this says plainly that it's a portfolio project. What I offer is the services below it (step 5.4c), and the CTA
// band closes the page.
import { CREDITS, repoLink } from '../../lib/credits';

export function Builder() {
  return (
    <section id="builder" aria-labelledby="builder-title" className="grid scroll-mt-6 gap-10 pb-24 min-[1100px]:grid-cols-[minmax(0,1fr)_480px] min-[1100px]:gap-14">
      <div className="flex flex-col gap-5">
        <h1 id="builder-title" className="font-display text-xl font-semibold min-[720px]:text-5xl">Built by {CREDITS.name}</h1>
        <p className="max-w-[640px] text-reading">
          NEXUS is a portfolio project. I built it end to end, along with the Northstar backend it watches.
        </p>
        <p className="max-w-[640px] text-reading">
          Why not just fix it yourself? You can, once you know it broke. A quiet failure shows up days later, as an enquiry
          nobody answered. What I build makes it show up first.
        </p>
        {repoLink() !== null && (
          <a href={repoLink() ?? undefined} className="inline-flex min-h-11 items-center self-start text-md font-medium underline underline-offset-[6px] hover:text-route">
            See the code on GitHub
          </a>
        )}
      </div>
      <figure className="flex flex-col gap-3.5">
        <a href="https://northstar-demodigital.netlify.app" className="block overflow-hidden rounded-md ring-1 ring-rule">
          {/* On screen at load at every width (the page's largest element), so it isn't lazy; 480 px wide from 1100 px,
              so a 1x screen takes the 640 px copy (7.1d, P2). */}
          <img
            src="/northstar.webp" srcSet="/northstar-640.webp 640w, /northstar.webp 1280w" sizes="(min-width: 1100px) 480px, (min-width: 720px) calc(100vw - 80px), calc(100vw - 32px)"
            width="1280" height="800" fetchPriority="high" decoding="async" alt="Northstar Digital's home page" className="block h-auto w-full"
          />
        </a>
        <figcaption className="text-base">
          <b className="font-semibold">The proof:</b> Northstar Digital, a demo agency site with a real backend (contact form, job
          queue, AI assistant), and NEXUS, the console it feeds.
        </figcaption>
      </figure>
    </section>
  );
}
