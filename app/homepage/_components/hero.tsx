import { heroKickers, logoStrip } from "./homepage-content"
import { LogoStrip } from "./logo-strip"
import { MarketingButton, VercelMark } from "./primitives"

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[calc(100svh-64px)] w-[calc(100%-48px)] max-w-[1400px] flex-col overflow-hidden">
      <div className="grid w-full flex-1 grid-cols-1 items-center gap-8 py-8 text-center min-[720px]:gap-12 min-[720px]:py-14 min-[961px]:grid-cols-[1fr_0.8fr_1fr] min-[961px]:gap-10 min-[961px]:py-0 min-[961px]:text-left md:py-16">
        <div className="order-2 min-[961px]:order-1 min-[961px]:w-[444px]">
          <h1 className="mx-auto max-w-[620px] text-[clamp(42px,13vw,52px)] leading-[1.05] font-normal text-black min-[961px]:mx-0 min-[961px]:max-w-[390px] min-[961px]:!text-[48px] sm:text-[64px] sm:leading-[0.98] md:text-[72px] xl:!max-w-[444px] xl:!text-[64px] xl:!leading-none">
            Agentic Infrastructure
          </h1>
          <p className="mt-4 font-mono text-sm text-neutral-700 min-[720px]:mt-6 min-[720px]:text-base min-[961px]:hidden">
            For coding agents
          </p>
          <div className="mx-auto mt-6 flex w-full max-w-[342px] flex-col justify-center gap-3 min-[480px]:w-auto min-[480px]:max-w-none min-[480px]:flex-row min-[720px]:mt-8 min-[961px]:mx-0 min-[961px]:justify-start">
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

        <div className="order-1 flex justify-center min-[961px]:order-2 min-[961px]:-translate-x-[26px] min-[961px]:translate-y-5">
          <div className="relative grid size-40 place-items-center min-[720px]:size-56 min-[961px]:size-56 sm:size-64 md:size-72">
            <VercelMark className="relative h-[118px] w-[136px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.14)] min-[720px]:h-[164px] min-[720px]:w-[188px] min-[961px]:!size-[217px] sm:h-[188px] sm:w-[216px] md:h-[214px] md:w-[248px]" />
          </div>
        </div>

        <div className="order-3 hidden -translate-x-2 justify-self-end min-[961px]:block">
          <div className="grid w-[348px] gap-4">
            {heroKickers.map((kicker) => (
              <p
                key={kicker.label}
                className="relative m-0 flex h-4 w-full cursor-default items-start overflow-hidden text-left font-mono text-sm leading-[1.6] font-normal text-black"
              >
                <span className="block">
                  <span className="inline shrink-0 font-mono text-sm font-semibold tracking-[1px] text-black uppercase">
                    {kicker.label}
                  </span>{" "}
                  {kicker.body}
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>
      <LogoStrip logos={logoStrip} />
    </section>
  )
}
