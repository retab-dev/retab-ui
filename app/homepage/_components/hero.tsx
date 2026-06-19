import { cn } from "@/lib/utils";

import { heroKickers, logoStrip } from "./homepage-content";
import { LogoStrip } from "./logo-strip";
import {
  focusRing,
  MarketingButton,
  MarketingContainer,
  VercelMark,
} from "./primitives";

type HeroKickerProps = {
  body: string;
  label: string;
};

function HeroKicker({ body, label }: HeroKickerProps) {
  return (
    <p
      aria-label={`${label} ${body}`}
      tabIndex={0}
      className={cn(
        "group/kicker relative m-0 flex max-h-5 w-full cursor-default items-start overflow-hidden rounded-sm text-left font-mono text-sm leading-5 font-normal text-pretty text-neutral-950 transition-all duration-200 ease-out hover:max-h-20 focus:max-h-20 motion-reduce:transition-none",
        focusRing,
      )}
    >
      <span className="block">
        <span className="inline shrink-0 font-mono text-sm font-semibold tracking-wider text-neutral-950 uppercase transition-colors duration-500 ease-out motion-reduce:transition-none">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="inline text-neutral-600 opacity-0 transition-opacity duration-300 ease-out group-hover/kicker:opacity-100 group-focus/kicker:opacity-100 motion-reduce:transition-none"
        >
          {" "}
          {body}
        </span>
      </span>
    </p>
  );
}

export function Hero() {
  return (
    <section className="w-full overflow-hidden">
      <MarketingContainer className="flex min-h-svh flex-col">
        <div className="grid w-full flex-1 grid-cols-1 items-center gap-8 py-8 text-center md:gap-12 md:py-16 lg:grid-cols-3 lg:gap-10 lg:pt-14 lg:pb-0 lg:text-left">
          <div className="order-2 mt-6 lg:order-1 lg:mt-0 lg:max-w-lg">
            <h1 className="md:text-homepage-hero mx-auto max-w-xl text-5xl leading-none font-normal text-black lg:mx-0 lg:max-w-lg">
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

          <div className="order-1 flex justify-center lg:order-2 lg:pt-12">
            <div className="grid size-52 place-items-center sm:size-64 md:size-72">
              <VercelMark className="size-52 md:size-56" />
            </div>
          </div>

          <div className="order-3 hidden justify-self-start lg:block">
            <div className="grid max-w-sm gap-5">
              {heroKickers.map((kicker) => (
                <HeroKicker
                  key={kicker.label}
                  body={kicker.body}
                  label={kicker.label}
                />
              ))}
            </div>
          </div>
        </div>
        <LogoStrip logos={logoStrip} />
      </MarketingContainer>
    </section>
  );
}
