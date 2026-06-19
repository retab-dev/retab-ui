import { heroKickers, logoStrip } from "./homepage-content";
import { LogoStrip } from "./logo-strip";
import { MarketingButton, VercelMark } from "./primitives";

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-screen-2xl flex-col overflow-hidden px-6">
      <div className="grid w-full flex-1 grid-cols-1 items-center gap-8 py-8 text-center md:gap-12 md:py-16 lg:grid-cols-3 lg:gap-10 lg:py-0 lg:text-left">
        <div className="order-2 mt-6 lg:order-1 lg:mt-0 lg:max-w-md">
          <h1 className="mx-auto max-w-xl text-5xl leading-none font-normal tracking-tighter text-black md:text-6xl lg:mx-0 lg:max-w-md">
            Agentic Infrastructure
          </h1>
          <p className="mt-4 font-mono text-sm text-neutral-700 md:mt-6 md:text-base lg:hidden">
            {heroKickers[0].label}
          </p>
          <div className="mx-auto mt-6 flex w-full max-w-sm flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row md:mt-8 lg:mx-0 lg:justify-start">
            <MarketingButton href="/new" className="w-full sm:w-auto">
              Deploy Now
            </MarketingButton>
            <MarketingButton
              href="/contact/sales/demo"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Talk to Sales
            </MarketingButton>
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2 lg:translate-y-5">
          <div className="relative grid size-48 place-items-center sm:size-64 md:size-72">
            <VercelMark className="relative size-52 md:size-56" />
          </div>
        </div>

        <div className="order-3 hidden justify-self-end lg:block">
          <div className="grid max-w-sm gap-4">
            {heroKickers.map((kicker) => (
              <div
                key={kicker.label}
                className="group relative z-10 m-0 flex h-4 w-full cursor-default items-start overflow-hidden text-left font-mono text-sm leading-6 font-normal text-pretty text-neutral-900 transition-[height] duration-200 ease-out hover:h-16 motion-reduce:transition-none"
              >
                <span className="block">
                  <span className="inline shrink-0 font-mono text-sm font-semibold tracking-wide text-neutral-900 uppercase transition-colors duration-500 ease-out">
                    {kicker.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline font-mono text-sm text-neutral-600 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 motion-reduce:transition-none"
                  >
                    {" "}
                    {kicker.body}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <LogoStrip logos={logoStrip} />
    </section>
  );
}
