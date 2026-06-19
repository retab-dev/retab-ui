import { MarketingButton } from "./primitives"

export function StartBuilding() {
  return (
    <section className="mt-28 border-t border-neutral-200 pt-20 pb-20">
      <div className="grid gap-8 lg:grid-cols-12">
        <h2 className="text-5xl leading-tight font-medium lg:col-span-4">
          Start building with Vercel now
        </h2>
        <div className="grid gap-5 lg:col-span-8 lg:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-6">
            <div className="font-mono text-xs font-semibold text-neutral-500 uppercase">
              For humans
            </div>
            <p className="mt-4 text-2xl leading-tight">
              Get started with Next.js and React in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MarketingButton href="https://vercel.com/templates/next.js/nextjs-boilerplate">
                Deploy a Next.js app
              </MarketingButton>
              <MarketingButton
                href="https://vercel.com/templates"
                variant="secondary"
              >
                Templates
              </MarketingButton>
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-6">
            <div className="font-mono text-xs font-semibold text-neutral-500 uppercase">
              For agents
            </div>
            <p className="mt-4 text-2xl leading-tight">
              Connect coding agents to infrastructure with commands they can
              run.
            </p>
            <div className="mt-8 rounded-md bg-black p-4 font-mono text-sm text-white">
              <span className="text-neutral-500">$ </span>npx plugins add
              vercel/vercel-plugin
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
