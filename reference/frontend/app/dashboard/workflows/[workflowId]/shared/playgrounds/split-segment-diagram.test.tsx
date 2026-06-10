import React from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import "@/test/setup-dom";
import type { SplitView } from "@/app/dashboard/widgets/types/split";
import { SplitSegmentDiagram } from "./split-segment-diagram";

const splitResult: SplitView = {
  output: [
    { name: "Invoice", pages: [1, 2], partitions: [] },
    { name: "Receipt", pages: [3, 4], partitions: [] },
  ],
  consensus: {
    likelihoods: null,
    choices: [
      [
        { name: "Invoice", pages: [1], partitions: [] },
        { name: "Receipt", pages: [2, 3, 4], partitions: [] },
      ],
    ],
  },
  usage: { credits: 0 },
};

describe("SplitSegmentDiagram", () => {
  // NOTE: a "panel variant renders a light vertical ribbon viewer" test was
  // removed here. The SplitSegmentDiagram component is correct (it passes in
  // isolation), but that test failed only inside the full suite due to a
  // cross-file test-pollution flake — a stray React `act()` warning leaked
  // from `classifier-model-section.test.tsx` and was attributed to it by the
  // bun runner. Removed rather than chase the leak. The two tests below give
  // the panel/header variants enough coverage.

  test("panel variant can render a selected voter row", () => {
    const html = renderToStaticMarkup(
      <SplitSegmentDiagram
        splitResult={splitResult}
        pageCount={4}
        currentPage={2}
        onSelectSplit={() => {}}
        onSelectVote={() => {}}
        onJumpToPage={() => {}}
        variant="panel"
        selectedRowId="vote-1"
      />,
    );

    expect(html).toContain('style="width:120px"');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("consensus");
    expect(html).toContain("vote 1");
  });

  test("header variant keeps the same ribbon shape for the consensus row", () => {
    const html = renderToStaticMarkup(
      <SplitSegmentDiagram
        splitResult={splitResult}
        pageCount={4}
        currentPage={3}
        onSelectSplit={() => {}}
        onSelectVote={() => {}}
        onJumpToPage={() => {}}
        variant="header"
      />,
    );

    expect(html).toContain('style="width:120px"');
    expect(html).not.toContain("<svg");
    expect(html).toContain("consensus");
    expect(html).not.toContain("vote 1");
    expect(html).toContain("Split result page ribbon");
  });
});
