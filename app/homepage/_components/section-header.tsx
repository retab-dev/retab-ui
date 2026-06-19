import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  description,
  titleClassName,
  descriptionClassName,
}: {
  title: string
  description: string
  titleClassName?: string
  descriptionClassName?: string
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-baseline">
      <h2
        className={cn(
          "text-6xl leading-none font-normal text-black md:text-7xl lg:text-[92px] xl:text-[110px]",
          titleClassName ?? "lg:col-span-4"
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "font-mono text-sm leading-6 text-neutral-700 lg:col-span-3",
          descriptionClassName ?? "lg:col-start-6"
        )}
      >
        {description}
      </p>
    </div>
  )
}
