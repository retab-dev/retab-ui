import { MarketingButton } from "./primitives"

export function StartBuilding() {
  return (
    <section className="mt-28 border-t border-neutral-200 pt-20 pb-20">
      <div className="mx-auto max-w-[820px] text-center">
        <h2 className="text-5xl leading-tight font-medium">
          Start building with Vercel now
        </h2>
        <div className="mt-12 grid gap-12 text-left md:grid-cols-2">
          <div>
            <p className="text-2xl leading-tight text-neutral-500">
              <span className="text-black">For humans.</span> Get started with
              Next.js and React in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MarketingButton href="https://vercel.com/templates/next.js/nextjs-boilerplate">
                Deploy a Next.js app
              </MarketingButton>
              <MarketingButton
                href="https://vercel.com/templates"
                variant="secondary"
              >
                View more templates
              </MarketingButton>
            </div>
          </div>
          <div>
            <p className="text-2xl leading-tight text-neutral-500">
              <span className="text-black">For agents.</span> Tools to connect
              your agents to Vercel infrastructure.
            </p>
            <a
              href="https://vercel.com/plugin"
              className="mt-8 inline-flex h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 font-mono text-sm text-black transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <span className="rounded-full bg-black px-2 py-0.5 font-sans text-xs font-medium text-white">
                Plugin
              </span>
              vercel-plugin
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
