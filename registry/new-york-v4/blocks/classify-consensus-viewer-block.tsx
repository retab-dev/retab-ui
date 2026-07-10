"use client";

import { ClassifyConsensusBlock } from "@/components/viewers/classify/classify-consensus-block";
import type { ViewerSource } from "@/components/ui/file-viewer";
import type { ClassifyResult } from "@/components/viewers/lib/classify-types";

const LOAN_APPLICATION_SOURCE: ViewerSource = {
  kind: "url",
  url: "/samples/loan-application.pdf",
  fileName: "loan-application.pdf",
};

const CLASSIFY_RESULT: ClassifyResult = {
  category: "Loan Application",
  candidates: [
    {
      category: "Loan Application",
      description: "Uniform Residential Loan Application Form 1003.",
    },
    {
      category: "Tax Form",
      description: "Structured form, but no IRS tax identifiers.",
    },
    {
      category: "Bank Statement",
      description: "Financial fields are present, but no transactions.",
    },
  ],
  reasoning:
    "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request.",
  consensus: {
    likelihoods: 0.67,
    choices: [
      {
        category: "Loan Application",
        reasoning:
          "The document is a Form 1003 loan application with borrower, employment, and property sections.",
      },
      {
        category: "Loan Application",
        reasoning:
          "The mortgage application fields and declarations match a loan application packet.",
      },
      {
        category: "Tax Form",
        reasoning:
          "The form is structured and financial, but it does not contain transaction rows or statement periods.",
      },
    ],
  },
};

export function ClassifyConsensusViewerBlock() {
  return (
    <ClassifyConsensusBlock
      source={LOAN_APPLICATION_SOURCE}
      result={CLASSIFY_RESULT}
      sidebarWidth="18rem"
      sidebarLabel="Classification consensus"
      minHeightClassName="min-h-[680px]"
    />
  );
}
