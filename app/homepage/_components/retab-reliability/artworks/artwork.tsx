import type { CardTheme, CardTone } from "../types";
import { HumanInLoopArt } from "./human-in-loop-art";
import { KLlmsConsensusArt } from "./k-llms-consensus-art";
import { StudioEvalsArt } from "./studio-evals-art";

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
  return <StudioEvalsArt tone={tone} />;
}
