import { logoStrip } from "./homepage-content"

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
      <div className="flex w-max min-w-0 items-center gap-12 px-6 text-neutral-950 motion-safe:animate-[homepage-logo-marquee_28s_linear_infinite] md:hidden">
        {repeatedLogos.map((logo, index) => (
          <BrandLogo key={`${logo}-${index}`} logo={logo} />
        ))}
      </div>
      <div className="mx-auto hidden w-full max-w-[1400px] min-w-0 items-center justify-between gap-8 px-6 text-neutral-950 md:flex">
        {logoStrip.map((logo) => (
          <BrandLogo key={logo} logo={logo} />
        ))}
      </div>
    </div>
  )
}

function BrandLogo({ logo }: { logo: string }) {
  if (logo === "BLACKBOX.AI") {
    return (
      <div className="flex shrink-0 items-center gap-1 text-base leading-none font-bold">
        <span className="block size-4 rotate-45 border-2 border-black" />
        BLACKBOX.AI
      </div>
    )
  }

  if (logo === "HH") {
    return <div className="shrink-0 text-3xl leading-none font-black">HH</div>
  }

  if (logo === "DOORDASH") {
    return (
      <div className="flex shrink-0 items-center gap-2 text-base leading-none font-bold">
        <span className="block h-2.5 w-7 rounded-full bg-black" />
        DOORDASH
      </div>
    )
  }

  if (logo === "charles SCHWAB") {
    return (
      <div className="shrink-0 text-center font-serif text-lg leading-[0.8] font-semibold">
        charles
        <br />
        <span className="font-sans text-sm">SCHWAB</span>
      </div>
    )
  }

  if (logo === "The Weather Company") {
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

  if (logo === "Polymarket") {
    return (
      <div className="flex shrink-0 items-center gap-2 text-lg leading-none font-semibold">
        <span className="block size-5 rotate-45 border-2 border-black" />
        Polymarket
      </div>
    )
  }

  return (
    <div className="shrink-0 text-lg leading-none font-semibold opacity-90">
      {logo}
    </div>
  )
}
