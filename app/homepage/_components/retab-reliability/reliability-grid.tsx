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
    mobileTitle: "Reviews",
    theme: "human_in_loop",
    row: 8,
  },
] satisfies readonly CardItem[];

const cardClassName = "h-full min-h-0 border border-border shadow-sm";
const evalsCardClassName = `${cardClassName} col-start-2 row-start-1 bg-card`;
const consensusCardClassName = `${cardClassName} col-start-1 row-start-1 row-span-2 bg-card`;
const validationCardClassName = `${cardClassName} col-start-2 row-start-2 bg-card`;
const titleClassName =
  "max-w-[98%] text-[15px] leading-[1.04] font-normal tracking-normal break-words text-foreground sm:text-lg sm:leading-[1.02]";

function getCardClassName(card: CardItem) {
  if (card.id === "k_llms_consensus") {
    return consensusCardClassName;
  }
  if (card.id === "studio_evals") {
    return evalsCardClassName;
  }
  if (card.id === "human_in_loop") {
    return validationCardClassName;
  }
  return cardClassName;
}

export function RetabReliabilityGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 gap-3 sm:aspect-[16/11] sm:gap-4"
    >
      {reliabilityCards.map((card) => (
        <DrawerCardTile
          key={card.id}
          card={card}
          cardClassName={getCardClassName(card)}
          titleClassName={titleClassName}
          tone="warm"
        />
      ))}
    </div>
  );
}
