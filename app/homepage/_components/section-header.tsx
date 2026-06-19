import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  description,
  flip = false,
}: {
  title: string
  description: string
  flip?: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-baseline">
      <h2
        className={cn(
          "text-6xl leading-none font-medium text-black md:text-7xl lg:text-[92px] xl:text-[112px]",
          flip ? "lg:col-span-4 lg:col-start-5" : "lg:col-span-5"
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "font-mono text-sm leading-6 text-neutral-700 lg:col-span-4",
          flip ? "lg:col-start-9" : "lg:col-start-8"
        )}
      >
        {description}
      </p>
    </div>
  )
}
