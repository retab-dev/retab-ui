import { cn } from "@/lib/utils";

export function SectionHeader({
  id,
  title,
  description,
  placement = "default",
}: {
  id?: string;
  title: string;
  description: string;
  placement?: "default" | "reversed";
}) {
  const isReversed = placement === "reversed";

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
      <h2
        id={id}
        className={cn(
          "text-[64px] leading-none font-normal tracking-[-0.05em] text-black md:text-7xl lg:text-[92px] xl:text-[110px]",
          isReversed ? "lg:col-span-4 lg:col-start-5" : "lg:col-span-4",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "max-w-md font-mono text-sm leading-5 text-neutral-700 lg:col-span-3 lg:mt-[38px]",
          isReversed ? "lg:col-start-10" : "lg:col-start-6",
        )}
      >
        {description}
      </p>
    </div>
  );
}
