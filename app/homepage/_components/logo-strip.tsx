import { logoStrip } from "./homepage-content"
import { type LogoContent } from "./homepage-types"

export function LogoStrip() {
  const repeatedLogos = [...logoStrip, ...logoStrip]

  return (
    <div className="w-full overflow-hidden pb-8 min-[961px]:pb-14">
      <style>{`
        @keyframes homepage-logo-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 1.5rem)); }
        }
      `}</style>
      <ul className="sr-only">
        {logoStrip.map((logo) => (
          <li key={logo.id}>{logo.label}</li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="flex w-max min-w-0 items-center gap-12 px-6 text-neutral-950 motion-safe:animate-[homepage-logo-marquee_28s_linear_infinite] md:hidden"
      >
        {repeatedLogos.map((logo, index) => (
          <BrandLogo key={`${logo.id}-${index}`} logo={logo} />
        ))}
      </div>
      <div className="mx-auto hidden w-[calc(100%-48px)] max-w-[1400px] min-w-0 items-center justify-between gap-8 text-neutral-950 md:flex">
        {logoStrip.map((logo) => (
          <BrandLogo key={logo.id} logo={logo} />
        ))}
      </div>
    </div>
  )
}

function BrandLogo({ logo }: { logo: LogoContent }) {
  if (logo.id === "blackbox") {
    return (
      <div className="flex shrink-0 items-center gap-1 text-base leading-none font-bold">
        <span className="block size-4 rotate-45 border-2 border-black" />
        {logo.label}
      </div>
    )
  }

  if (logo.id === "hh") {
    return (
      <div className="shrink-0 text-3xl leading-none font-black">
        {logo.label}
      </div>
    )
  }

  if (logo.id === "doordash") {
    return (
      <div className="flex shrink-0 items-center gap-2 text-base leading-none font-bold">
        <span className="block h-2.5 w-7 rounded-full bg-black" />
        {logo.label}
      </div>
    )
  }

  if (logo.id === "schwab") {
    return (
      <div className="shrink-0 text-center font-serif text-lg leading-[0.8] font-semibold">
        charles
        <br />
        <span className="font-sans text-sm">SCHWAB</span>
      </div>
    )
  }

  if (logo.id === "weather") {
    return (
      <div className="shrink-0 text-center text-sm leading-[0.9] font-black">
        The
        <br />
        Weather
        <br />
        Company
      </div>
    )
  }

  if (logo.id === "polymarket") {
    return (
      <div className="flex shrink-0 items-center gap-2 text-lg leading-none font-semibold">
        <span className="block size-5 rotate-45 border-2 border-black" />
        {logo.label}
      </div>
    )
  }

  return (
    <div className="shrink-0 text-lg leading-none font-semibold opacity-90">
      {logo.label}
    </div>
  )
}
