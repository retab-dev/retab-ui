import { type LogoContent } from "./homepage-types"

export function LogoStrip({ logos }: { logos: readonly LogoContent[] }) {
  const repeatedLogos = [...logos, ...logos]

  return (
    <div className="w-full overflow-hidden pb-8 min-[961px]:pb-14">
      <style>{`
        @keyframes homepage-logo-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 1.5rem)); }
        }
      `}</style>
      <ul className="sr-only">
        {logos.map((logo) => (
          <li key={logo.id}>{logo.label}</li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="flex w-max min-w-0 items-center gap-12 px-6 text-neutral-950 motion-safe:animate-[homepage-logo-marquee_28s_linear_infinite] motion-reduce:hidden md:hidden"
      >
        {repeatedLogos.map((logo, index) => (
          <BrandLogo key={`${logo.id}-${index}`} logo={logo} />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="hidden flex-wrap items-center justify-center gap-x-10 gap-y-6 px-6 text-neutral-950 motion-reduce:flex md:hidden"
      >
        {logos.map((logo) => (
          <BrandLogo key={logo.id} logo={logo} />
        ))}
      </div>
      <div className="mx-auto hidden w-[calc(100%-48px)] max-w-[1400px] min-w-0 items-center justify-between gap-8 text-neutral-950 md:flex">
        {logos.map((logo) => (
          <BrandLogo key={logo.id} logo={logo} />
        ))}
      </div>
    </div>
  )
}

function BrandLogo({ logo }: { logo: LogoContent }) {
  switch (logo.variant) {
    case "diamond-wordmark":
      return (
        <div className="flex shrink-0 items-center gap-1 text-base leading-none font-bold">
          <span className="block size-4 rotate-45 border-2 border-black" />
          {logo.label}
        </div>
      )
    case "monogram":
      return (
        <div className="shrink-0 text-3xl leading-none font-black">
          {logo.label}
        </div>
      )
    case "pill-wordmark":
      return (
        <div className="flex shrink-0 items-center gap-2 text-base leading-none font-bold">
          <span className="block h-2.5 w-7 rounded-full bg-black" />
          {logo.label}
        </div>
      )
    case "stacked-serif":
      return (
        <div className="shrink-0 text-center font-serif text-lg leading-[0.8] font-semibold">
          <StackedLogo
            lines={logo.lines ?? [logo.label]}
            lastLineClassName="font-sans text-sm"
          />
        </div>
      )
    case "stacked-bold":
      return (
        <div className="shrink-0 text-center text-sm leading-[0.9] font-black">
          <StackedLogo lines={logo.lines ?? [logo.label]} />
        </div>
      )
    case "large-diamond-wordmark":
      return (
        <div className="flex shrink-0 items-center gap-2 text-lg leading-none font-semibold">
          <span className="block size-5 rotate-45 border-2 border-black" />
          {logo.label}
        </div>
      )
    case "text":
      return (
        <div className="shrink-0 text-lg leading-none font-semibold opacity-90">
          {logo.label}
        </div>
      )
    default:
      return assertNever(logo.variant)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled logo variant: ${value}`)
}

function StackedLogo({
  lastLineClassName,
  lines,
}: {
  lastLineClassName?: string
  lines: readonly string[]
}) {
  return (
    <>
      {lines.map((line, index) => {
        const isLastLine = index === lines.length - 1

        return (
          <span
            key={`${line}-${index}`}
            className={isLastLine ? lastLineClassName : undefined}
          >
            {line}
            {isLastLine ? null : <br />}
          </span>
        )
      })}
    </>
  )
}
