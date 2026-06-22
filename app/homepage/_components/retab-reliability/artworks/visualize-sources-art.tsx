"use client";

import { FileThumbnail } from "@/components/ui/file-thumbnail";

import type { CardTone } from "../types";

type SourceRegion = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  labelPlacement?: "inside" | "right";
};

const PAGE_ASPECT_RATIO = 612 / 792;

const BANK_STATEMENT_SOURCE = {
  kind: "url",
  url: "/sample_documents/bank-statement.pdf",
  fileName: "bank-statement.pdf",
  mimeType: "application/pdf",
  identityKey: "homepage-source-grounding-bank-statement",
} as const;

const SOURCE_REGIONS = [
  {
    id: "account-details",
    label: "account details",
    left: 0.1,
    top: 0.06,
    width: 0.43,
    height: 0.2,
    labelPlacement: "right",
  },
  {
    id: "account-number",
    label: "account number",
    left: 0.56,
    top: 0.17,
    width: 0.34,
    height: 0.1,
  },
  {
    id: "balance-summary",
    label: "balance summary",
    left: 0.1,
    top: 0.31,
    width: 0.8,
    height: 0.16,
  },
  {
    id: "deposits",
    label: "deposits",
    left: 0.1,
    top: 0.49,
    width: 0.8,
    height: 0.15,
  },
] satisfies readonly SourceRegion[];

export function VisualizeSourcesArt({
  tone: _tone = "default",
}: {
  tone?: CardTone;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="bg-muted/50 absolute inset-0" />
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0"
          style={{ aspectRatio: String(PAGE_ASPECT_RATIO) }}
        >
          <FileThumbnail
            source={BANK_STATEMENT_SOURCE}
            as="pdf"
            anchor="top-left"
            presentation="decorative"
            previewAspectRatio={PAGE_ASPECT_RATIO}
            className="bg-card absolute inset-0 size-full rounded-none border-0"
          />

          <div className="absolute inset-0">
            {SOURCE_REGIONS.map((region) => (
              <SourceRegionBox key={region.id} region={region} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRegionBox({ region }: { region: SourceRegion }) {
  return (
    <span
      data-source-region={region.id}
      className="border-success/90 bg-success/20 absolute rounded-[2px] border-2"
      style={{
        left: `${region.left * 100}%`,
        top: `${region.top * 100}%`,
        width: `${region.width * 100}%`,
        height: `${region.height * 100}%`,
      }}
    >
      <span
        className={
          region.labelPlacement === "right"
            ? "bg-success text-success-foreground absolute top-1/2 left-full ml-1.5 -translate-y-1/2 rounded-[2px] px-1.5 py-0.5 text-[8px] leading-none font-medium tracking-wide whitespace-nowrap uppercase"
            : "bg-success text-success-foreground absolute top-1 left-1 rounded-[2px] px-1.5 py-0.5 text-[8px] leading-none font-medium tracking-wide whitespace-nowrap uppercase"
        }
      >
        {region.label}
      </span>
    </span>
  );
}
