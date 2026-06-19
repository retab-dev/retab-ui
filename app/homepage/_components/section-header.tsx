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
          "lg:text-homepage-section text-foreground text-6xl leading-none font-normal tracking-tighter text-balance md:text-7xl lg:col-span-4",
          isReversed && "lg:col-start-5",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "text-muted-foreground max-w-md font-mono text-sm leading-5 text-pretty lg:col-span-3 lg:col-start-6 lg:mt-10",
          isReversed && "lg:col-start-10",
        )}
      >
        {description}
      </p>
    </div>
  );
}
