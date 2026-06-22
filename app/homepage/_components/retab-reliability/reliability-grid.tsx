import { DrawerCardTile } from "./card-tile";
import type { CardItem } from "./types";

const reliabilityCards = [
  {
    id: "k_llms_consensus",
    title: "k-LLMs Consensus",
    theme: "k_llms_consensus",
    row: 9,
  },
  {
    id: "studio_evals",
    title: "Evals & monitoring",
    theme: "studio_evals",
    row: 8,
  },
  {
    id: "human_in_loop",
    title: "Review-based validation",
    theme: "human_in_loop",
    row: 8,
  },
] satisfies readonly CardItem[];

const cardClassName =
  "h-full min-h-64 border border-border/70 shadow-sm sm:min-h-0";
const fullHeightCardClassName = `${cardClassName} sm:row-span-2`;
const titleClassName =
  "max-w-[98%] text-base leading-[1.02] font-normal tracking-normal text-foreground sm:text-lg";

export function RetabReliabilityGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full grid-cols-1 gap-3 sm:aspect-[16/11] sm:grid-cols-2 sm:grid-rows-2 sm:gap-4"
    >
      {reliabilityCards.map((card) => (
        <DrawerCardTile
          key={card.id}
          card={card}
          cardClassName={
            card.id === "k_llms_consensus"
              ? fullHeightCardClassName
              : cardClassName
          }
          titleClassName={titleClassName}
          tone="warm"
        />
      ))}
    </div>
  );
}
