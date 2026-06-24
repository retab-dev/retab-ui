import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { DrawerCardArt } from "./artworks/artwork";
import type { CardItem, CardTone } from "./types";

export type DrawerCardTileProps = {
  card: CardItem;
  cardClassName: string;
  titleClassName: string;
  wideSpanClassName?: string;
  tone?: CardTone;
};

export function DrawerCardTile({
  card,
  cardClassName,
  titleClassName,
  wideSpanClassName,
  tone = "default",
}: DrawerCardTileProps) {
  const tileShellClassName =
    tone === "warm"
      ? "group relative gap-0 overflow-hidden rounded-sm border-0 bg-muted/40 p-0 shadow-none transition-all duration-300 ease-out before:shadow-none dark:bg-muted/20 dark:before:shadow-none"
      : "group relative gap-0 overflow-hidden rounded-sm border-0 bg-muted/30 p-0 shadow-none transition-all duration-300 ease-out before:shadow-none dark:bg-muted/15 dark:before:shadow-none";
  const headerClassName =
    card.id === "studio_evals" ||
    card.id === "k_llms_consensus" ||
    card.id === "human_in_loop"
      ? "relative z-10 shrink-0 px-2.5 pt-3 pb-0 max-sm:gap-0 max-sm:pb-2! sm:px-4 sm:pt-6 sm:pb-0"
      : "relative z-10 shrink-0 p-3 pb-0 max-sm:gap-0 max-sm:pb-2! sm:p-4 sm:pb-0";

  return (
    <Card
      className={cn(
        tileShellClassName,
        "flex flex-col",
        cardClassName,
        card.isWide ? wideSpanClassName : undefined,
      )}
    >
      <CardHeader className={headerClassName}>
        <div className="flex flex-col gap-1 pl-0.5 sm:pl-2">
          {card.mobileTitle ? (
            <>
              <CardTitle className={cn(titleClassName, "sm:hidden")}>
                {card.mobileTitle}
              </CardTitle>
              <CardTitle className={cn(titleClassName, "hidden sm:block")}>
                {card.title}
              </CardTitle>
            </>
          ) : (
            <CardTitle className={cn(titleClassName)}>{card.title}</CardTitle>
          )}
          {card.subtitle && (
            <p className="text-muted-foreground font-[family-name:var(--font-dm-sans)] text-xs leading-relaxed font-normal md:text-sm">
              {card.subtitle}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative z-10 min-h-0 flex-1 p-0">
        <div className="relative h-full w-full overflow-hidden">
          <DrawerCardArt theme={card.theme} cardId={card.id} tone={tone} />
        </div>
      </CardContent>
    </Card>
  );
}
