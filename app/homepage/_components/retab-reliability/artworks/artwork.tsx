import type { CardTheme, CardTone } from "../types";
import { FastModeArt } from "./fast-mode-art";
import { HumanInLoopArt } from "./human-in-loop-art";
import { KLlmsConsensusArt } from "./k-llms-consensus-art";
import { StudioEvalsArt } from "./studio-evals-art";
import { VisualizeSourcesArt } from "./visualize-sources-art";

export function DrawerCardArt({
  theme,
  tone = "default",
}: {
  theme: CardTheme;
  cardId?: string;
  tone?: CardTone;
}) {
  if (theme === "human_in_loop") {
    return <HumanInLoopArt tone={tone} />;
  }
  if (theme === "k_llms_consensus") {
    return <KLlmsConsensusArt tone={tone} />;
  }
  if (theme === "visualize_sources") {
    return <VisualizeSourcesArt tone={tone} />;
  }
  if (theme === "fast_mode") {
    return <FastModeArt />;
  }
  return <StudioEvalsArt tone={tone} />;
}
