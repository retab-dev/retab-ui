import { heroKickers, logoStrip } from "./homepage-content";
import { LogoStrip } from "./logo-strip";
import { MarketingButton, VercelMark } from "./primitives";

export function Hero() {
  return (
    <section className="mx-auto flex h-[calc(100svh-4rem)] w-full max-w-screen-2xl flex-col overflow-hidden px-6">
      <div className="grid w-full flex-1 grid-cols-1 items-center gap-8 py-8 text-center md:gap-12 md:py-16 lg:grid-cols-3 lg:gap-10 lg:py-0 lg:text-left">
        <div className="order-2 mt-6 lg:order-1 lg:mt-0 lg:max-w-lg">
          <h1 className="mx-auto max-w-xl text-5xl leading-none font-normal text-black md:text-6xl lg:mx-0 lg:max-w-lg">
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

        <div className="order-1 flex justify-center lg:order-2 lg:pt-8">
          <div className="grid size-52 place-items-center sm:size-64 md:size-72">
            <VercelMark className="size-52 drop-shadow-2xl md:size-56" />
          </div>
        </div>

        <div className="order-3 hidden justify-self-start lg:block lg:pt-6 lg:pl-7">
          <div className="grid max-w-sm gap-5">
            {heroKickers.map((kicker) => (
              <p
                key={kicker.label}
                className="font-mono text-sm leading-5 font-semibold text-black uppercase"
              >
                {kicker.label}
              </p>
            ))}
          </div>
        </div>
      </div>
      <LogoStrip logos={logoStrip} />
    </section>
  );
}
