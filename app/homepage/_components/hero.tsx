import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { heroKickers, logoStrip } from "./homepage-content";
// import { HeroCompositeInstallDropdown } from "./hero-composite-install-dropdown";
import { LogoStrip } from "./logo-strip";
import { focusRing, MarketingButton, MarketingContainer } from "./primitives";

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
        "group/kicker text-foreground relative m-0 flex max-h-5 w-full cursor-default items-start overflow-hidden rounded-sm text-left font-mono text-sm leading-5 font-normal text-pretty transition-all duration-200 ease-out hover:max-h-20 focus:max-h-20 motion-reduce:transition-none",
        focusRing,
      )}
    >
      <span className="block">
        <span className="text-foreground inline shrink-0 font-mono text-sm font-semibold tracking-wider uppercase transition-colors duration-500 ease-out motion-reduce:transition-none">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="text-muted-foreground inline opacity-0 transition-opacity duration-300 ease-out group-hover/kicker:opacity-100 group-focus/kicker:opacity-100 motion-reduce:transition-none"
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
        <div className="grid w-full flex-1 grid-cols-1 items-center gap-8 py-8 text-left md:gap-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_max-content] lg:gap-16 lg:pt-14 lg:pb-0">
          <div className="mt-6 lg:mt-0">
            <a
              href="https://www.retab.com/blog/politaxsplit"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "border-border bg-card/80 text-muted-foreground hover:text-foreground/75 mb-6 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors motion-reduce:transition-none",
                focusRing,
              )}
            >
              Retab split beats Google
              <ArrowUpRight aria-hidden="true" className="size-3 flex-none" />
            </a>
            <h1 className="text-foreground lg:text-homepage-hero max-w-xl text-4xl leading-[1.05] font-normal sm:text-5xl md:text-6xl lg:max-w-4xl lg:leading-none">
              End-to-end automation for your hardest document workflows.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed font-light md:mt-6 md:leading-6">
              Process documents at scale — with configurable business rules,
              cross-document checks, and human review for exceptions.
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-3 sm:max-w-2xl sm:flex-row sm:items-center md:mt-8 lg:mx-0">
              <MarketingButton
                href="/dashboard/production"
                className="w-full sm:w-44"
              >
                Start free
              </MarketingButton>
              <MarketingButton
                href="https://calendar.app.google/1PTAx2rZjEWiH28n6"
                variant="secondary"
                className="w-full sm:w-44"
              >
                Get a demo
              </MarketingButton>
              {/*
              <HeroCompositeInstallDropdown className="w-full sm:w-auto" />
              */}
            </div>
          </div>

          <div className="hidden justify-self-start lg:block">
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
