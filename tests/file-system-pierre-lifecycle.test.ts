import { preparePresortedFileTreeInput } from "@pierre/trees";
import { describe, expect, it } from "vitest";

import type {
  FileSystemListContinuityIdentity,
  FileSystemListExpansionSnapshot,
} from "@/registry/new-york-v4/ui/file-system-list-continuity";
import {
  classifyFileSystemListContinuityTransition,
  createFileSystemListContinuityPlan,
  createFileSystemListContinuityState,
  reduceFileSystemListContinuity,
} from "@/registry/new-york-v4/ui/file-system-list-continuity";
import type { FileSystemPierreInput } from "@/registry/new-york-v4/ui/file-system-pierre-input";
import {
  createFileSystemPierreLazyFolderCommand,
  createFileSystemPierreLazyRetryCommand,
} from "@/registry/new-york-v4/ui/file-system-pierre-lazy-retry";
import type { FileSystemEntry } from "@/registry/new-york-v4/ui/file-system-types";

type FileSystemListIdentity =
  FileSystemListContinuityIdentity<FileSystemPierreInput>;

function input(pierrePaths: string[]): FileSystemPierreInput {
  return {
    entriesByPierrePath: new Map(
      pierrePaths.map((path) => [
        path,
        {
          kind: path.endsWith("/") ? "folder" : "file",
          path,
        } as FileSystemEntry,
      ]),
    ),
    pierrePaths,
    preparedInput: preparePresortedFileTreeInput(pierrePaths),
  };
}

function identity({
  currentPath = "",
  decorationVersion = "stable",
  hasSemanticQuery = false,
  pierrePaths = ["reports/", "reports/report.pdf"],
}: {
  currentPath?: string;
  decorationVersion?: string;
  hasSemanticQuery?: boolean;
  pierrePaths?: string[];
} = {}): FileSystemListIdentity {
  const runtimeInput = input(pierrePaths);

  return {
    currentPath,
    decorationVersion,
    hasSemanticQuery,
    input: {
      itemPaths: runtimeInput.pierrePaths,
      runtimeInput,
    },
  };
}

function snapshots(entries: Array<[string, FileSystemListExpansionSnapshot]>) {
  return new Map(entries);
}

describe("file-system Pierre lifecycle", () => {
  it("classifies unchanged identity as same", () => {
    const previous = identity();

    expect(
      classifyFileSystemListContinuityTransition(previous, previous),
    ).toMatchObject({ kind: "same" });
  });

  it("classifies path, query, decoration, and input transitions by semantic priority", () => {
    const previous = identity();
    const nextInput = identity({ pierrePaths: ["archive/", "archive/a.pdf"] });

    expect(
      classifyFileSystemListContinuityTransition(
        previous,
        identity({ currentPath: "archive/" }),
      ).kind,
    ).toBe("path");
    expect(
      classifyFileSystemListContinuityTransition(
        previous,
        identity({ hasSemanticQuery: true }),
      ).kind,
    ).toBe("query-enter");
    expect(
      classifyFileSystemListContinuityTransition(
        identity({ hasSemanticQuery: true }),
        identity({ hasSemanticQuery: true, pierrePaths: ["reports/"] }),
      ).kind,
    ).toBe("query-update");
    expect(
      classifyFileSystemListContinuityTransition(
        identity({ hasSemanticQuery: true }),
        identity({ hasSemanticQuery: false }),
      ).kind,
    ).toBe("query-exit");
    expect(
      classifyFileSystemListContinuityTransition(
        previous,
        identity({ decorationVersion: "loading" }),
      ).kind,
    ).toBe("decoration");
    expect(
      classifyFileSystemListContinuityTransition(previous, nextInput).kind,
    ).toBe("input");
  });

  it("creates no continuity plan for an unchanged lifecycle", () => {
    const previous = identity();
    const transition = classifyFileSystemListContinuityTransition(
      previous,
      previous,
    );

    expect(
      createFileSystemListContinuityPlan({
        pendingRevealPath: null,
        snapshotsByCurrentPath: snapshots([]),
        transition,
      }),
    ).toEqual({ kind: "none" });
  });

  it("restores compatible normal expansion for path, input, query-exit, and decoration transitions", () => {
    const currentSnapshot: FileSystemListExpansionSnapshot = {
      expandedItemPaths: new Set(["reports/", "removed/"]),
      mode: "normal",
    };
    const cases = [
      {
        next: identity({ currentPath: "archive/" }),
        previous: identity({ currentPath: "" }),
        snapshotKey: "archive/",
      },
      {
        next: identity({ decorationVersion: "changed" }),
        previous: identity(),
        snapshotKey: "",
      },
      {
        next: identity({ pierrePaths: ["reports/", "reports/next.pdf"] }),
        previous: identity(),
        snapshotKey: "",
      },
      {
        next: identity({ hasSemanticQuery: false }),
        previous: identity({ hasSemanticQuery: true }),
        snapshotKey: "",
      },
    ];

    for (const { next, previous, snapshotKey } of cases) {
      const transition = classifyFileSystemListContinuityTransition(
        previous,
        next,
      );
      const plan = createFileSystemListContinuityPlan({
        pendingRevealPath: null,
        snapshotsByCurrentPath: snapshots([[snapshotKey, currentSnapshot]]),
        transition,
      });

      if (plan.kind === "apply") {
        expect(plan.expandedPaths).toEqual(["reports/"]);
      }
    }
  });

  it("opens all directories while semantic query is active without needing a normal snapshot", () => {
    const transition = classifyFileSystemListContinuityTransition(
      identity(),
      identity({
        hasSemanticQuery: true,
        pierrePaths: ["reports/", "reports/report.pdf", "archive/"],
      }),
    );

    expect(
      createFileSystemListContinuityPlan({
        pendingRevealPath: null,
        snapshotsByCurrentPath: snapshots([]),
        transition,
      }),
    ).toMatchObject({
      expandedPaths: ["reports/", "archive/"],
      kind: "apply",
    });
  });

  it("reduces the continuity phase graph directly", () => {
    const previous = identity();
    const next = identity({ pierrePaths: ["reports/", "reports/next.pdf"] });
    const initial = {
      ...createFileSystemListContinuityState<FileSystemPierreInput>(),
      identity: previous,
      pendingRevealPath: "reports/next.pdf",
    };
    const capturing = reduceFileSystemListContinuity(initial, {
      identity: next,
      type: "identity.requested",
    });

    expect(capturing.state.phase).toBe("capturing");
    expect(capturing.commands).toEqual([
      { identity: previous, type: "snapshot.capture" },
    ]);

    const applying = reduceFileSystemListContinuity(capturing.state, {
      expandedPaths: ["reports/"],
      identity: previous,
      type: "snapshot.captured",
    });

    expect(applying.state.phase).toBe("applying");
    expect(applying.commands).toEqual([
      {
        expandedPaths: ["reports/"],
        identity: next,
        nextItemPaths: ["reports/", "reports/next.pdf"],
        revealPath: "reports/next.pdf",
        type: "model.apply",
      },
    ]);

    const revealing = reduceFileSystemListContinuity(applying.state, {
      expandedPaths: ["reports/"],
      identity: next,
      type: "model.applied",
    });

    expect(revealing.state.phase).toBe("revealing");
    expect(revealing.commands).toEqual([
      { path: "reports/next.pdf", type: "selection.reveal" },
    ]);

    const stable = reduceFileSystemListContinuity(revealing.state, {
      type: "selection.revealed",
    });

    expect(stable.state.phase).toBe("stable");
    expect(stable.state.pendingRevealPath).toBeNull();
  });

  it("creates lazy retry commands only for failed folder selections", () => {
    const folderSelection = {
      entry: { kind: "folder", path: "lazy/" } as FileSystemEntry,
      pierrePath: "lazy/",
    };
    const fileSelection = {
      entry: { kind: "file", path: "lazy/file.pdf" } as FileSystemEntry,
      pierrePath: "lazy/file.pdf",
    };

    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map([["lazy/", "failed"]]),
        selection: folderSelection,
      }),
    ).toEqual({
      entryPath: "lazy/",
      kind: "retry-and-expand",
      pierrePath: "lazy/",
    });
    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map(),
        selection: folderSelection,
      }),
    ).toBeNull();
    expect(
      createFileSystemPierreLazyRetryCommand({
        folderErrors: new Map([["lazy/", "failed"]]),
        selection: fileSelection,
      }),
    ).toBeNull();
  });

  it("creates normal lazy load commands for folders without errors", () => {
    expect(
      createFileSystemPierreLazyFolderCommand({
        folderErrors: new Map(),
        selection: {
          entry: { kind: "folder", path: "lazy/" } as FileSystemEntry,
          pierrePath: "lazy/",
        },
      }),
    ).toEqual({ entryPath: "lazy/", kind: "load" });
  });
});
