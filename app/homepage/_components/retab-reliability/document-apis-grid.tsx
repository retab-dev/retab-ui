import { DrawerCardTile } from "./card-tile";
import type { CardItem } from "./types";

const documentApiCards = [
  {
    id: "k_llms_consensus",
    title: "Confidence scoring",
    theme: "k_llms_consensus",
    row: 9,
  },
  {
    id: "model_router",
    title: "Smart routing",
    theme: "fast_mode",
    row: 9,
  },
  {
    id: "visualize_sources",
    title: "Source grounding",
    theme: "visualize_sources",
    row: 9,
  },
] satisfies readonly CardItem[];

const cardClassName = "h-full min-h-80 md:min-h-0";
const titleClassName =
  "max-w-[98%] text-base leading-[1.02] font-normal tracking-normal text-foreground sm:text-lg";

export function RetabDocumentApisGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full grid-cols-1 gap-3 sm:gap-4 md:aspect-[16/11] md:grid-cols-3"
    >
      {documentApiCards.map((card) => (
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
