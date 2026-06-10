import { describe, expect, test } from "bun:test";

import type { SplitView } from "@/app/dashboard/widgets/types/split";

import {
  buildPageRuns,
  buildSplitDiagramRows,
  buildSplitDiagramTicks,
  getMaxSplitDiagramPage,
} from "./split-segment-diagram-utils";

describe("split segment diagram utils", () => {
  test("buildPageRuns compacts and sorts page ranges", () => {
    expect(buildPageRuns([5, 2, 3, 2, 9, 10, 12])).toEqual([
      { start_page: 2, end_page: 3 },
      { start_page: 5, end_page: 5 },
      { start_page: 9, end_page: 10 },
      { start_page: 12, end_page: 12 },
    ]);
  });

  test("buildSplitDiagramRows creates a document-wide consensus row and vote rows", () => {
    const splitView: SplitView = {
      output: [
        {
          name: "invoice",
          pages: [5, 1, 2],
          partitions: [],
        },
        {
          name: "receipt",
          pages: [3, 4],
          partitions: [],
        },
        {
          name: "packing_list",
          pages: [8, 9],
          partitions: [],
        },
      ],
      consensus: {
        likelihoods: null,
        choices: [
          [
            { name: "invoice", pages: [1, 2, 4], partitions: [] },
            { name: "receipt", pages: [3], partitions: [] },
            { name: "packing_list", pages: [8, 9], partitions: [] },
          ],
        ],
      },
      usage: {
        credits: 0,
      },
    };

    const rows = buildSplitDiagramRows(splitView);

    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe("consensus");
    expect(
      rows[0].segments.map((segment) => ({
        splitName: segment.splitName,
        startPage: segment.startPage,
        endPage: segment.endPage,
      })),
    ).toEqual([
      { splitName: "invoice", startPage: 1, endPage: 2 },
      { splitName: "receipt", startPage: 3, endPage: 4 },
      { splitName: "invoice", startPage: 5, endPage: 5 },
      { splitName: "packing_list", startPage: 8, endPage: 9 },
    ]);

    expect(rows[1].label).toBe("vote 1");
    expect(
      rows[1].segments.map((segment) => ({
        splitName: segment.splitName,
        startPage: segment.startPage,
        endPage: segment.endPage,
      })),
    ).toEqual([
      { splitName: "invoice", startPage: 1, endPage: 2 },
      { splitName: "receipt", startPage: 3, endPage: 3 },
      { splitName: "invoice", startPage: 4, endPage: 4 },
      { splitName: "packing_list", startPage: 8, endPage: 9 },
    ]);

    expect(rows[0].segments[0].color).toBe(rows[0].segments[2].color);
    expect(rows[0].segments[0].color).toBe(rows[1].segments[0].color);
  });

  test("getMaxSplitDiagramPage considers consensus pages, votes, and partitions", () => {
    const splitView: SplitView = {
      output: [
        {
          name: "invoice",
          pages: [1],
          partitions: [
            {
              key: "INV-001",
              pages: [6],
            },
          ],
        },
      ],
      consensus: {
        likelihoods: null,
        choices: [[{ name: "invoice", pages: [7], partitions: [] }]],
      },
      usage: {
        credits: 0,
      },
    };

    expect(getMaxSplitDiagramPage(splitView)).toBe(7);
  });

  test("buildSplitDiagramTicks keeps a readable tick cadence for longer documents", () => {
    expect(buildSplitDiagramTicks(75)).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75,
    ]);
  });
});
