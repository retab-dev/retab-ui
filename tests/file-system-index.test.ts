import { describe, expect, it } from "vitest";

import { buildFileSystemIndex } from "@/registry/new-york-v4/ui/file-system-index";
import {
  DEFAULT_FILE_SYSTEM_SORT,
  deriveVisibleIndex,
  getFileSystemCategory,
} from "@/registry/new-york-v4/ui/file-system-query";
import type { FileSystemItem } from "@/registry/new-york-v4/ui/file-system-types";

const items: FileSystemItem[] = [
  {
    kind: "file",
    path: "invoices/2026/january.pdf",
    mimeType: "application/pdf",
    size: 10,
    updatedAt: "2026-01-04T00:00:00Z",
  },
  {
    kind: "file",
    path: "invoices/2025/december.csv",
    mimeType: "text/csv",
    size: 4,
    updatedAt: "2025-12-30T00:00:00Z",
  },
  {
    kind: "folder",
    path: "archive",
    name: "Archive",
    hasChildren: true,
  },
];

describe("file-system index", () => {
  it("infers folder chains and normalizes explicit folders", () => {
    const index = buildFileSystemIndex(items);

    expect(index.folders.get("invoices/")?.name).toBe("invoices");
    expect(index.folders.get("invoices/2026/")?.parentPath).toBe("invoices/");
    expect(index.folders.get("archive/")?.name).toBe("Archive");
    expect(index.folders.get("archive/")?.hasChildren).toBe(true);
    expect(index.files.get("invoices/2026/january.pdf")?.key).toBe(
      "invoices/2026/january.pdf",
    );
  });

  it("derives folder modified dates from newest descendants", () => {
    const index = buildFileSystemIndex(items);

    expect(index.folders.get("invoices/")?.updatedAt).toBe(
      "2026-01-04T00:00:00Z",
    );
  });

  it("search keeps matching files and ancestors visible", () => {
    const index = buildFileSystemIndex(items);
    const visible = deriveVisibleIndex(index, "", {
      search: "january",
      sort: DEFAULT_FILE_SYSTEM_SORT,
    });

    expect(visible.children.get("")?.map((entry) => entry.path)).toEqual([
      "invoices/",
    ]);
    expect(
      visible.children.get("invoices/")?.map((entry) => entry.path),
    ).toEqual(["invoices/2026/"]);
    expect(
      getFileSystemCategory(visible.files.get("invoices/2026/january.pdf")!),
    ).toBe("pdf");
  });

  it("indexes and searches a large object-store manifest", () => {
    const largeItems: FileSystemItem[] = Array.from(
      { length: 5_000 },
      (_, index) => ({
        kind: "file",
        path: `workspace/batch-${Math.floor(index / 100)}/document-${index}.pdf`,
        mimeType: "application/pdf",
        size: index,
      }),
    );

    const index = buildFileSystemIndex(largeItems);
    const visible = deriveVisibleIndex(index, "workspace/", {
      search: "document-4999",
      sort: DEFAULT_FILE_SYSTEM_SORT,
    });

    expect(index.files.size).toBe(5_000);
    expect(index.folders.size).toBe(51);
    expect(
      visible.children.get("workspace/")?.map((entry) => entry.path),
    ).toEqual(["workspace/batch-49/"]);
    expect(visible.children.get("workspace/batch-49/")?.[0]?.path).toBe(
      "workspace/batch-49/document-4999.pdf",
    );
  });
});
