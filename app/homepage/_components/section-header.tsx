import { cn } from "@/lib/utils"

export function SectionHeader({
  id,
  title,
  description,
  placement = "default",
}: {
  id?: string
  title: string
  description: string
  placement?: "default" | "reversed"
}) {
  const isReversed = placement === "reversed"

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
      <h2
        id={id}
        className={cn(
          "text-[clamp(48px,14vw,72px)] leading-none font-normal text-black md:text-7xl lg:text-[92px] xl:text-[110px]",
          isReversed ? "lg:col-span-4 lg:col-start-5" : "lg:col-span-6"
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "max-w-md font-mono text-sm leading-6 text-neutral-700 lg:col-span-3 lg:pt-2",
          isReversed ? "lg:col-start-9" : "lg:col-start-8"
        )}
      >
        {description}
      </p>
    </div>
  )
}
