import { ArrowUpRight, Terminal } from "lucide-react"

import { MarketingButton } from "./primitives"

export function StartBuilding() {
  return (
    <section
      className="pt-40 pb-24 md:pt-[168px]"
      aria-labelledby="start-building-heading"
    >
      <div className="text-center">
        <h2
          id="start-building-heading"
          className="mx-auto max-w-[760px] text-[40px] leading-tight font-normal text-black sm:text-5xl"
        >
          Start building with Vercel now
        </h2>

        <div className="mt-14 grid min-w-0 gap-10 border-y border-neutral-200 py-10 text-left md:grid-cols-2 md:gap-5">
          <div className="flex min-w-0 flex-col justify-between md:border-r md:border-neutral-200 md:pr-10">
            <div>
              <p className="max-w-md text-base leading-7 text-neutral-600">
                <span className="text-black">For humans.</span> Get started with
                Next.js and React in seconds.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <MarketingButton
                  href="https://vercel.com/templates/next.js/nextjs-boilerplate"
                  aria-label="Deploy a Next.js app template on Vercel"
                  className="gap-2"
                >
                  Deploy a Next.js app
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </MarketingButton>
                <MarketingButton
                  href="https://vercel.com/templates"
                  aria-label="View more Vercel templates"
                  variant="secondary"
                  className="gap-2"
                >
                  View more templates
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </MarketingButton>
              </div>
            </div>

            <div className="mt-10 grid overflow-hidden rounded-md border border-neutral-200 bg-white text-xs">
              <div className="grid grid-cols-[96px_1fr] border-b border-neutral-200">
                <div className="border-r border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-neutral-500">
                  stack
                </div>
                <div className="px-3 py-2 font-medium text-black">
                  Next.js + React
                </div>
              </div>
              <div className="grid grid-cols-[96px_1fr] border-b border-neutral-200">
                <div className="border-r border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-neutral-500">
                  deploy
                </div>
                <div className="px-3 py-2 font-medium text-black">
                  global edge network
                </div>
              </div>
              <div className="grid grid-cols-[96px_1fr]">
                <div className="border-r border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-neutral-500">
                  preview
                </div>
                <div className="px-3 py-2 font-medium text-black">
                  every commit
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between md:pl-10">
            <div>
              <p className="max-w-md text-base leading-7 text-neutral-600">
                <span className="text-black">For agents.</span> Tools to connect
                your agents to Vercel infrastructure.
              </p>
              <a
                href="https://vercel.com/plugin"
                aria-label="Open the Vercel Plugin page"
                className="group mt-8 block overflow-hidden rounded-md border border-neutral-200 bg-black text-white transition-[border-color,box-shadow] hover:border-black hover:shadow-[0_18px_60px_rgba(0,0,0,0.16)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Terminal aria-hidden="true" className="size-4" />
                    <span className="font-mono text-sm">Plugin</span>
                  </div>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
                  />
                </div>
                <pre className="overflow-x-auto px-4 py-5 font-mono text-xs leading-6 text-white">
                  <code>
                    <span className="text-white/40">$</span> npx plugins add
                    vercel/vercel-plugin
                  </code>
                </pre>
                <div className="grid grid-cols-3 border-t border-white/10 text-center font-mono text-xs text-white/65">
                  <div className="border-r border-white/10 px-3 py-3">CLI</div>
                  <div className="border-r border-white/10 px-3 py-3">MCP</div>
                  <div className="px-3 py-3">API</div>
                </div>
              </a>
            </div>

            <div className="mt-10 grid grid-cols-3 overflow-hidden rounded-md border border-neutral-200 bg-white text-center font-mono text-xs">
              <div className="border-r border-neutral-200 px-3 py-3 text-neutral-600">
                ship
              </div>
              <div className="border-r border-neutral-200 px-3 py-3 text-neutral-600">
                observe
              </div>
              <div className="px-3 py-3 text-neutral-600">recover</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
