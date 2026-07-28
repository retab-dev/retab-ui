"use client";

import * as React from "react";
import { Atom, Blend } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculateConsensusContent,
  confidenceTier,
  getReasoningPath,
  getValueByPath,
  resolveFieldConfidence,
  type ConfidenceTier,
  type ConsensusAlternative,
  type ConsensusChoice,
  type ConsensusContent,
  type FieldConfidence,
} from "@/components/json-form-retab/field-metadata-core";

type JsonFormMetadataContextValue = {
  consensusDetails?: ConsensusChoice[];
  likelihoods?: Record<string, number>;
  showConfidence: boolean;
  showConsensus: boolean;
  showReasoning: boolean;
};

const JsonFormMetadataContext =
  React.createContext<JsonFormMetadataContextValue>({
    showConfidence: false,
    showConsensus: false,
    showReasoning: false,
  });

export function JsonFormMetadataProvider({
  children,
  consensusDetails,
  likelihoods,
  showConfidence = false,
  showConsensus = false,
  showReasoning = false,
}: {
  children: React.ReactNode;
  consensusDetails?: ConsensusChoice[];
  likelihoods?: Record<string, number>;
  showConfidence?: boolean;
  showConsensus?: boolean;
  showReasoning?: boolean;
}) {
  const value = React.useMemo(
    () => ({
      consensusDetails,
      // The consolidated choice carries the run's own per-field likelihoods,
      // so consensus callers get calibrated confidence without extra plumbing.
      likelihoods: likelihoods ?? consensusDetails?.[0]?.likelihoods,
      showConfidence,
      showConsensus,
      showReasoning,
    }),
    [
      consensusDetails,
      likelihoods,
      showConfidence,
      showConsensus,
      showReasoning,
    ],
  );

  return (
    <JsonFormMetadataContext.Provider value={value}>
      {children}
    </JsonFormMetadataContext.Provider>
  );
}

// The shared tooltip surface is inverted (`bg-foreground text-background`), so
// everything inside these panels is toned against `background`, not `foreground`.
const tooltipViewportClassName = "max-h-[min(24rem,80vh)] overflow-auto pr-1";
const tooltipContentClassName = "z-[140] max-w-xs";
const tooltipHeadingClassName = "text-info text-xs font-medium";
const tooltipMutedClassName = "text-background/70 text-xs";
const quotedValueClassName =
  "bg-background/10 text-background/90 border-background/20 rounded border p-1 text-xs leading-snug font-medium whitespace-pre-wrap";

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/**
 * Tier palette. High confidence stays achromatic so a healthy form reads as one
 * calm column of labels; doubt is the only thing that earns color.
 */
const CONFIDENCE_TIER_STYLES: Record<
  ConfidenceTier,
  { fill: string; text: string }
> = {
  high: { fill: "bg-success", text: "text-muted-foreground" },
  medium: { fill: "bg-warning", text: "text-warning-foreground" },
  low: { fill: "bg-destructive", text: "text-destructive-foreground" },
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ConfidenceBar({
  confidence,
  show,
}: {
  confidence: FieldConfidence | null;
  show: boolean;
}) {
  if (!show || !confidence) {
    return null;
  }

  const tier = confidenceTier(confidence.value);
  const styles = CONFIDENCE_TIER_STYLES[tier];
  const percent = formatPercent(confidence.value);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="meter"
          aria-label="Extraction confidence"
          aria-valuenow={Math.round(confidence.value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          data-confidence-tier={tier}
          className="flex shrink-0 cursor-default items-center gap-1"
        >
          <span className="bg-foreground/10 ring-foreground/5 h-1 w-7 overflow-hidden rounded-full ring-1 ring-inset">
            <span
              className={cn(
                "block h-full rounded-full transition-[width] duration-300 ease-out",
                styles.fill,
              )}
              style={{ width: `${Math.max(confidence.value, 0.04) * 100}%` }}
            />
          </span>
          <span
            className={cn(
              "text-[10px] leading-none font-medium tabular-nums",
              styles.text,
            )}
          >
            {percent}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className={tooltipContentClassName}>
        <div className="space-y-1">
          <div className="text-xs font-medium">Confidence {percent}</div>
          <div className={tooltipMutedClassName}>
            {confidence.source === "likelihood"
              ? "Model likelihood for this field."
              : `${confidence.agreeing} of ${confidence.count} runs produced this value.`}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Reasoning & consensus
// ---------------------------------------------------------------------------

function ReasoningBadge({
  content,
  hideWhenConsensus,
  show,
}: {
  content: unknown;
  hideWhenConsensus?: boolean;
  show: boolean;
}) {
  if (!show || !content || hideWhenConsensus) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 cursor-default items-center">
          <Atom className="text-info size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className={tooltipContentClassName}>
        <div className={tooltipViewportClassName}>
          <div className={cn(tooltipHeadingClassName, "mb-1")}>Reasoning</div>
          {typeof content === "string" ? (
            <div className="break-words whitespace-pre-wrap">{content}</div>
          ) : (
            <pre className={quotedValueClassName}>
              {JSON.stringify(content, null, 2)}
            </pre>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ConsensusReasoningBadge({
  content,
  show,
}: {
  content: ConsensusContent | null;
  show: boolean;
}) {
  if (!show || !content) {
    return null;
  }

  const reasonedAlternatives = content.alternatives.filter(
    (alternative: ConsensusAlternative) => !!alternative.reasoning,
  );

  if (reasonedAlternatives.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 cursor-default items-center">
          <Atom className="text-info size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className={cn(tooltipContentClassName, "break-words")}>
        <div className={tooltipViewportClassName}>
          <div className={cn(tooltipHeadingClassName, "mb-1")}>
            Model reasonings
          </div>
          <div className="space-y-2">
            {reasonedAlternatives.map((alternative) => (
              <div key={alternative.index} className="space-y-1">
                <div className={tooltipMutedClassName}>
                  Model {alternative.index - 1}
                </div>
                <div className={quotedValueClassName}>
                  {alternative.reasoning}
                </div>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function formatConsensusValue(value: unknown) {
  return typeof value === "object"
    ? JSON.stringify(value)
    : String(value || "null");
}

function ConsensusBadge({
  consolidatedValue,
  content,
  show,
}: {
  consolidatedValue: unknown;
  content: ConsensusContent | null;
  show: boolean;
}) {
  if (!show || !content) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 cursor-default items-center">
          <Blend className="text-info size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className={tooltipContentClassName}>
        <div className="space-y-2">
          <div className={tooltipHeadingClassName}>Consensus</div>
          <div className="text-xs">
            {formatPercent(content.agreement)} agreement across {content.count}{" "}
            runs
            {content.hasVariation ? (
              <span className={cn(tooltipMutedClassName, "ml-1")}>
                • variation detected
              </span>
            ) : null}
          </div>

          <div className={tooltipMutedClassName}>Consolidated</div>
          <div className={cn(quotedValueClassName, "truncate")}>
            {formatConsensusValue(consolidatedValue)}
          </div>

          <div className={tooltipMutedClassName}>Alternatives</div>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {content.alternatives.map((alternative) => (
              <div
                key={alternative.index}
                className="flex items-center gap-2 text-xs"
              >
                Model {alternative.index - 1}:
                <div className={cn(quotedValueClassName, "truncate")}>
                  {formatConsensusValue(alternative.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The metadata strip that trails a field label: reasoning trace, consensus
 * spread, and the confidence bar — in that order, so the eye lands on the
 * number last and can stop scanning once a field reads as certain.
 */
export function JsonFormFieldMetadataBadges({
  name,
  sourcePath,
  value,
}: {
  name: string;
  sourcePath: string;
  value?: unknown;
}) {
  const {
    consensusDetails,
    likelihoods,
    showConfidence,
    showConsensus,
    showReasoning,
  } = React.useContext(JsonFormMetadataContext);
  const { control, getValues } = useFormContext<Record<string, unknown>>();
  const reasoningPath = getReasoningPath(name);
  const watchedReasoning = useWatch({
    control,
    disabled: !showReasoning,
    name: reasoningPath,
  });
  const reasoningContent =
    watchedReasoning ?? getValueByPath(getValues(), reasoningPath);
  const consensusContent = React.useMemo(
    () => calculateConsensusContent(consensusDetails, sourcePath),
    [consensusDetails, sourcePath],
  );
  const confidence = React.useMemo(
    () => resolveFieldConfidence(likelihoods, consensusContent, sourcePath),
    [consensusContent, likelihoods, sourcePath],
  );
  const consolidatedValue =
    value !== undefined ? value : consensusContent?.consolidated_value;

  if (!showReasoning && !showConsensus && !showConfidence) {
    return null;
  }

  return (
    <>
      <ReasoningBadge
        show={showReasoning}
        content={reasoningContent}
        hideWhenConsensus={showConsensus && !!consensusContent}
      />
      {showReasoning && showConsensus ? (
        <ConsensusReasoningBadge show content={consensusContent} />
      ) : null}
      <ConsensusBadge
        show={showConsensus}
        consolidatedValue={consolidatedValue}
        content={consensusContent}
      />
      <ConfidenceBar show={showConfidence} confidence={confidence} />
    </>
  );
}
