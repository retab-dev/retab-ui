import { heroKickers, heroPillars, logoStrip } from "./data"
import { MarketingButton, VercelMark } from "./primitives"

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-64px)] flex-col overflow-hidden border-b border-neutral-100">
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-12 px-6 py-14 text-center md:py-16 min-[961px]:-translate-y-5 min-[961px]:grid-cols-[1fr_0.8fr_1fr] min-[961px]:gap-10 min-[961px]:py-0 min-[961px]:text-left">
        <div className="order-2 min-[961px]:order-1">
          <h1 className="mx-auto max-w-[620px] text-[clamp(42px,13vw,52px)] leading-[1.05] font-normal tracking-[-0.04em] text-black sm:text-[64px] sm:leading-[0.98] md:text-[72px] min-[961px]:mx-0 min-[961px]:max-w-[390px] min-[961px]:text-[64px]">
            Agentic Infrastructure
          </h1>
          <p className="mt-6 font-mono text-sm text-neutral-700 min-[961px]:hidden">
            For coding agents
          </p>
          <div className="mx-auto mt-8 flex w-full max-w-[342px] flex-col justify-center gap-3 min-[480px]:w-auto min-[480px]:max-w-none min-[480px]:flex-row min-[961px]:mx-0 min-[961px]:justify-start">
            <MarketingButton
              href="https://vercel.com/new"
              className="w-full min-[480px]:w-auto"
            >
              Deploy Now
            </MarketingButton>
            <MarketingButton
              href="https://vercel.com/contact/sales/demo"
              variant="secondary"
              className="w-full min-[480px]:w-auto"
            >
              Talk to Sales
            </MarketingButton>
          </div>
        </div>

        <div className="order-1 flex justify-center min-[961px]:order-2">
          <div className="relative grid size-56 place-items-center sm:size-64 md:size-72 min-[961px]:size-56">
            <VercelMark className="relative border-x-[94px] border-b-[164px] sm:border-x-[108px] sm:border-b-[188px] md:border-x-[122px] md:border-b-[214px] min-[961px]:border-x-[94px] min-[961px]:border-b-[164px]" />
          </div>
        </div>

        <div className="order-3 hidden justify-self-center min-[961px]:block">
          <div className="space-y-5 font-mono text-sm font-semibold text-black uppercase">
            {heroKickers.map((kicker) => (
              <p key={kicker}>{kicker}</p>
            ))}
          </div>
        </div>
      </div>
      <LogoStrip />
    </section>
  )
}

function LogoStrip() {
  const repeatedLogos = [...logoStrip, ...logoStrip]

  return (
    <div className="w-full overflow-hidden pb-8 min-[961px]:pb-14">
      <style>{`
        @keyframes homepage-logo-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 1.5rem)); }
        }
      `}</style>
      <div className="motion-safe:animate-[homepage-logo-marquee_28s_linear_infinite] flex w-max min-w-0 items-center gap-12 px-6 text-neutral-950 md:hidden">
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
      <div className="flex shrink-0 items-center gap-1 text-base leading-none font-bold tracking-[-0.01em]">
        <span className="block size-4 rotate-45 border-2 border-black" />
        BLACKBOX.AI
      </div>
    )
  }

  if (logo === "HH") {
    return (
      <div className="shrink-0 text-3xl leading-none font-black tracking-[-0.08em]">
        HH
      </div>
    )
  }

  if (logo === "DOORDASH") {
    return (
      <div className="flex shrink-0 items-center gap-2 text-base leading-none font-bold tracking-[0.08em]">
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
        <span className="font-sans text-sm tracking-[0.08em]">SCHWAB</span>
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

export function HeroPillars() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 border-t border-neutral-100 px-6 py-8 md:grid-cols-3">
      {heroPillars.map((pillar) => (
        <p
          key={pillar}
          className="max-w-md font-mono text-sm leading-6 text-neutral-700"
        >
          {pillar}
        </p>
      ))}
    </div>
  )
}
