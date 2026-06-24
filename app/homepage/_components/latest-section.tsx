import type { CSSProperties } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content";
import { LatestConstellationCanvas } from "./latest-constellation";
import {
  type FeaturedLatestCard as FeaturedLatestCardContent,
  type SecondaryLatestCard as SecondaryLatestCardContent,
  type SecondaryLatestCardVisual,
} from "./homepage-types";
import { focusRing } from "./primitives";
import { SectionHeader } from "./section-header";

const latestCardClass = cn(
  "group relative flex min-w-0 overflow-hidden rounded-md border border-border bg-card text-card-foreground transition-colors hover:border-foreground/30 hover:bg-background focus-visible:border-foreground/40 active:bg-card motion-reduce:transition-none",
  focusRing,
);

const secondaryLatestCardClass = cn(
  latestCardClass,
  "min-h-72 flex-col p-5 sm:p-6 md:aspect-video lg:h-homepage-latest-card lg:min-h-0 lg:aspect-auto",
);

const enterpriseDots = [
  { x: 18, y: 38, delay: 0, duration: 6.4, dx1: -8, dy1: 7, dx2: 9, dy2: -5 },
  { x: 28, y: 28, delay: 420, duration: 7.1, dx1: 7, dy1: -6, dx2: -9, dy2: 5 },
  { x: 39, y: 36, delay: 860, duration: 6.8, dx1: -5, dy1: -8, dx2: 7, dy2: 8 },
  {
    x: 52,
    y: 24,
    delay: 180,
    duration: 7.6,
    dx1: 10,
    dy1: 5,
    dx2: -6,
    dy2: -7,
  },
  {
    x: 66,
    y: 34,
    delay: 1040,
    duration: 6.9,
    dx1: -7,
    dy1: 6,
    dx2: 8,
    dy2: -6,
  },
  {
    x: 78,
    y: 26,
    delay: 640,
    duration: 7.4,
    dx1: 6,
    dy1: 9,
    dx2: -10,
    dy2: -4,
  },
  {
    x: 24,
    y: 56,
    delay: 1320,
    duration: 7.8,
    dx1: 9,
    dy1: -5,
    dx2: -7,
    dy2: 6,
  },
  { x: 38, y: 66, delay: 260, duration: 6.6, dx1: -9, dy1: -7, dx2: 6, dy2: 5 },
  {
    x: 54,
    y: 56,
    delay: 1480,
    duration: 7.2,
    dx1: 8,
    dy1: 6,
    dx2: -5,
    dy2: -9,
  },
  {
    x: 70,
    y: 64,
    delay: 920,
    duration: 6.7,
    dx1: -6,
    dy1: -9,
    dx2: 10,
    dy2: 4,
  },
  {
    x: 84,
    y: 52,
    delay: 1560,
    duration: 7.5,
    dx1: 5,
    dy1: 7,
    dx2: -8,
    dy2: -6,
  },
] as const;

export function LatestSection() {
  return (
    <section
      className="relative z-10 mt-16 md:mt-24 lg:mt-36"
      aria-label="Latest Retab updates"
    >
      <SectionHeader
        title="Latest"
        description="Recent product updates and releases from Retab."
      />
      <div className="mt-16 grid gap-5 lg:mt-20 lg:grid-cols-2 lg:items-stretch">
        <FeaturedLatestCardLink card={featuredLatestCard} />
        <div className="lg:grid-rows-homepage-latest grid gap-5">
          {secondaryLatestCards.map((card) => (
            <SecondaryLatestCardLink key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedLatestCardLink({ card }: { card: FeaturedLatestCardContent }) {
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.alt}`}
      className={cn(
        latestCardClass,
        "aspect-video w-full items-center justify-center lg:aspect-auto lg:h-full",
      )}
    >
      <LatestConstellationCanvas />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 px-6 text-center">
        <span className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Blog
        </span>
        <span className="text-muted-foreground text-sm">
          Retab&apos;s engineering blog
        </span>
      </div>
    </Link>
  );
}

function SecondaryLatestCardLink({
  card,
}: {
  card: SecondaryLatestCardContent;
}) {
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.body}`}
      className={secondaryLatestCardClass}
    >
      <SecondaryLatestVisual visual={card.visual} />
      <header className="absolute bottom-5 left-5 z-10 flex w-full flex-col gap-1.5 pr-10">
        <h3 className="min-w-0 text-2xl leading-tight font-medium break-words sm:text-3xl">
          {card.label}
        </h3>
        <p className="text-muted-foreground max-w-72 font-mono text-sm leading-5 break-words">
          {card.body}
        </p>
      </header>
    </Link>
  );
}

function SecondaryLatestVisual({
  visual,
}: {
  visual: SecondaryLatestCardVisual;
}) {
  switch (visual.kind) {
    case "retab-ui":
      return <RetabUiGraphic />;
    case "enterprise-dots":
      return <EnterpriseDotsGraphic />;
  }
}

function RetabUiGraphic() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden opacity-80 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
    >
      <div className="absolute inset-0 bg-white" />
      <div className="absolute top-5 right-5 left-5 grid max-w-md grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] gap-3 font-mono text-xs sm:top-10 sm:right-10 sm:left-auto sm:w-96">
        <div className="border-border/70 bg-background/80 flex min-w-0 flex-col rounded-md border shadow-sm backdrop-blur">
          <div className="border-border/70 text-muted-foreground flex h-8 items-center gap-2 border-b px-2">
            <span className="bg-foreground/20 h-3 w-3 rounded-sm" />
            <span className="truncate">file-viewer.tsx</span>
          </div>
          <div className="space-y-2 p-2">
            <div className="border-border/70 bg-card h-14 rounded border" />
            <div className="grid grid-cols-3 gap-1.5">
              <span className="bg-foreground/15 h-2 rounded" />
              <span className="bg-foreground/10 h-2 rounded" />
              <span className="bg-foreground/15 h-2 rounded" />
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-2">
          <div className="border-border/70 bg-background/80 rounded-md border p-2 shadow-sm backdrop-blur">
            <div className="grid grid-cols-3 gap-1.5">
              <span className="bg-foreground/20 h-2 rounded" />
              <span className="bg-foreground/10 h-2 rounded" />
              <span className="bg-foreground/15 h-2 rounded" />
            </div>
            <div className="border-border/60 mt-2 grid grid-cols-3 gap-px overflow-hidden rounded border">
              {Array.from({ length: 9 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "bg-card h-4",
                    index % 2 === 0 && "bg-muted/60",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="border-border/70 bg-background/80 grid grid-cols-2 gap-2 rounded-md border p-2 shadow-sm backdrop-blur">
            <span className="border-border/60 bg-card h-8 rounded border" />
            <span className="border-border/60 bg-card h-8 rounded border" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EnterpriseDotsGraphic() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden opacity-75 transition-opacity duration-300 group-hover:opacity-95 group-focus-visible:opacity-95 motion-reduce:transition-none"
    >
      <div className="absolute inset-0 bg-white" />
      <div className="absolute top-8 right-8 h-36 w-64 sm:top-12 sm:right-14">
        {enterpriseDots.map((dot, index) => (
          <span
            key={`${dot.x}-${dot.y}`}
            className={cn(
              "homepage-enterprise-dot bg-foreground/50 absolute size-1.5 rounded-full",
              index % 3 === 0 && "size-2",
            )}
            style={
              {
                "--dot-duration": `${dot.duration}s`,
                "--dot-x-1": `${dot.dx1}px`,
                "--dot-x-2": `${dot.dx2}px`,
                "--dot-y-1": `${dot.dy1}px`,
                "--dot-y-2": `${dot.dy2}px`,
                animationDelay: `${dot.delay}ms`,
                left: `${dot.x}%`,
                top: `${dot.y}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
