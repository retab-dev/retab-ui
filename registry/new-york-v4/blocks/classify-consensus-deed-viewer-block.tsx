"use client";

import { ClassifyConsensusBlock } from "@/components/viewers/classify/classify-consensus-block";
import type { ViewerSource } from "@/components/ui/file-viewer";
import type {
  ClassifyCandidate,
  ClassifyResult,
} from "@/components/viewers/lib/classify-types";

type DeedClassifyCandidate = ClassifyCandidate & {
  handleKey: string;
};

const RECORDED_DEED_SOURCE: ViewerSource = {
  kind: "url",
  url: "/samples/recorded-warranty-deed.pdf",
  fileName: "recorded-warranty-deed.pdf",
};

const DEED_CANDIDATES: readonly DeedClassifyCandidate[] = [
  {
    handleKey: "deed",
    category: "Deed",
    description:
      "When input document is a deed conveying ownership of a property from one party to another",
  },
  {
    handleKey: "deed-of-trust",
    category: "Deed of Trust",
    description:
      "When input document is a deed of trust, mortgage, security instrument, promissory note or bond",
  },
  {
    handleKey: "judgment",
    category: "Judgment",
    description:
      "When input document is a judgment, an order issued by a governmental judiciary branch, probate, writ or lis pendens",
  },
  {
    handleKey: "lien",
    category: "Lien",
    description:
      "When input document is a lien or financing statement, financing statement assignment, financing statement continuation or financing statement termination",
  },
  {
    handleKey: "agreement-or-notice",
    category: "Agreement or Notice",
    description: "When the input document is an agreement, assumption or notice",
  },
  {
    handleKey: "child-document",
    category: "Child Document",
    description:
      "When the input document is a subordination, substitution, assignment, or modification",
  },
  {
    handleKey: "easement",
    category: "Easement",
    description: "When the input document is an easement",
  },
  {
    handleKey: "general",
    category: "General",
    description:
      "When the input document is not a deed, deed of trust, mortgage, promissory note, bond, judgment, lien, agreement, notice, substitution, subordination, modification, financing statement, assumption, writ, lis pendens, probate, assignment or easement. Other documents that belong to this general category: affidavits, power of attorney, resolutions, declarations, covenants, conditions and restrictions, and releases.",
  },
];

const DEED_CLASSIFY_RESULT: ClassifyResult = {
  category: "Deed",
  candidates: DEED_CANDIDATES,
  reasoning:
    "The instrument contains operative grant language, names a grantor and grantees, identifies consideration and transfer tax, and includes a legal description for real property. It expressly says no deed of trust, mortgage, note, or security instrument is created by this conveyance.",
  consensus: {
    likelihoods: 0.82,
    choices: [
      {
        category: "Deed",
        reasoning:
          "The first page says Grant Deed and conveys all right, title, and interest from Harbor View Holdings, LLC to Avery and Morgan Chen.",
      },
      {
        category: "Deed",
        reasoning:
          "The document changes fee ownership, lists grantor and grantees, and provides a legal description of the property.",
      },
      {
        category: "Deed of Trust",
        reasoning:
          "The instrument mentions deed of trust and mortgage terms, but only to exclude them from this conveyance.",
      },
      {
        category: "Deed",
        reasoning:
          "Recording request, transfer tax, APN, grant language, and notary acknowledgment match a recorded deed.",
      },
      {
        category: "General",
        reasoning:
          "The notary certificate and change of ownership report could appear in general recording packets, but the primary instrument is still a deed.",
      },
    ],
  },
};

export function ClassifyConsensusDeedViewerBlock() {
  return (
    <ClassifyConsensusBlock
      source={RECORDED_DEED_SOURCE}
      result={DEED_CLASSIFY_RESULT}
      sidebarWidth="22rem"
      sidebarLabel="Deed classification consensus"
      minHeightClassName="min-h-[760px]"
    />
  );
}
