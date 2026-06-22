import { DrawerCardTile } from "./card-tile";
import type { CardItem } from "./types";

const reliabilityCards = [
  {
    id: "k_llms_consensus",
    title: "Confidence scoring",
    theme: "k_llms_consensus",
    row: 9,
  },
  {
    id: "visualize_sources",
    title: "Source grounding",
    theme: "visualize_sources",
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

const cardClassName = "h-full min-h-0";
const titleClassName =
  "max-w-[98%] text-base leading-[1.02] font-normal tracking-normal text-foreground sm:text-lg";

export function RetabReliabilityGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid aspect-[16/11] w-full grid-cols-2 gap-3 sm:gap-4"
    >
      {reliabilityCards.map((card) => (
        <DrawerCardTile
          key={card.id}
          card={card}
          cardClassName={cardClassName}
          titleClassName={titleClassName}
          tone="warm"
        />
      ))}
    </div>
  );
}
