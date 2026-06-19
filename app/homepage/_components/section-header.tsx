export function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-baseline">
      <h2 className="text-6xl leading-none font-medium text-black md:text-7xl lg:col-span-5 lg:text-[112px]">
        {title}
      </h2>
      <p className="font-mono text-sm leading-6 text-neutral-700 lg:col-span-4 lg:col-start-8">
        {description}
      </p>
    </div>
  )
}
