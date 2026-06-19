import { heroKickers } from "./homepage-content"
import { LogoStrip } from "./logo-strip"
import { MarketingButton, VercelMark } from "./primitives"

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-64px)] flex-col overflow-hidden border-b border-neutral-100">
      <div className="mx-auto grid w-[calc(100%-48px)] max-w-[1400px] flex-1 grid-cols-1 items-center gap-12 py-14 text-center min-[961px]:-translate-y-5 min-[961px]:grid-cols-[1fr_0.8fr_1fr] min-[961px]:gap-10 min-[961px]:py-0 min-[961px]:text-left md:py-16">
        <div className="order-2 min-[961px]:order-1">
          <h1 className="mx-auto max-w-[620px] text-[clamp(42px,13vw,52px)] leading-[1.05] font-normal text-black min-[961px]:mx-0 min-[961px]:max-w-[390px] min-[961px]:text-[56px] sm:text-[64px] sm:leading-[0.98] md:text-[72px] xl:text-[64px]">
            Agentic Infrastructure
          </h1>
          <p className="mt-6 font-mono text-base text-neutral-700 min-[961px]:hidden">
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
          <div className="relative grid size-56 place-items-center min-[961px]:size-56 sm:size-64 md:size-72">
            <span
              aria-hidden="true"
              className="absolute size-[320px] rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.08)_36%,transparent_68%)] blur-3xl"
            />
            <VercelMark className="relative h-[164px] w-[188px] drop-shadow-[0_42px_56px_rgba(0,0,0,0.22)] min-[961px]:!h-[164px] min-[961px]:!w-[188px] sm:h-[188px] sm:w-[216px] md:h-[214px] md:w-[248px]" />
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
