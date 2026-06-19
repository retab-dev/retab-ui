import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const samplePath = new URL(
  "../components/viewers/sample-data/json-form-sources.json",
  import.meta.url,
);
const registryPath = new URL(
  "../public/r/json-form-sources-block.json",
  import.meta.url,
);

function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

type DateSourceLeaf = {
  value: string;
  source: { content: string; anchor: PdfBboxAnchor };
};

type PdfBboxAnchor = {
  kind: "pdf_bbox";
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

type SourcedLeaf = {
  value: unknown;
  source: { content: string; anchor: PdfBboxAnchor };
};

type HomepageSourcesSample = {
  schema: {
    properties: {
      statement_date: { format?: string };
      transactions: {
        items: { properties: { date: { format?: string } } };
      };
    };
  };
  extraction: {
    statement_date: string;
    transactions: Array<{ date: string }>;
  };
  sources: {
    statement_date: DateSourceLeaf;
    transactions: Array<{
      date: DateSourceLeaf;
      description: SourcedLeaf;
      amount: SourcedLeaf;
    }>;
  };
};

const rowsPerPage = [18, 28, 28, 28, 28];

function pageForTransaction(index: number): number {
  let seen = 0;
  for (const [pageIndex, count] of rowsPerPage.entries()) {
    seen += count;
    if (index < seen) return pageIndex + 1;
  }
  throw new Error(`Missing page for transaction ${index}`);
}

function expectedTransactionDate(index: number): string {
  const date = new Date(Date.UTC(2003, 5, 6));
  date.setUTCDate(date.getUTCDate() + Math.floor(index / 4));
  return date.toISOString().slice(0, 10);
}

describe("homepage sources sample", () => {
  it("uses exact PDF snippets for date sources and complete extracted dates", () => {
    const sample = readJson<HomepageSourcesSample>(samplePath);

    expect(sample.schema.properties.statement_date.format).toBe("date");
    expect(
      sample.schema.properties.transactions.items.properties.date.format,
    ).toBe("date");

    expect(sample.extraction.statement_date).toBe("2003-07-08");
    expect(sample.sources.statement_date).toMatchObject({
      value: "2003-07-08",
      source: { content: "July 8, 2003" },
    });

    for (const [
      index,
      transaction,
    ] of sample.extraction.transactions.entries()) {
      const sourceDate = sample.sources.transactions[index].date;

      expect(transaction.date).toMatch(/^2003-(06|07)-\d{2}$/);
      expect(transaction.date >= "2003-06-06").toBe(true);
      expect(transaction.date <= "2003-07-08").toBe(true);
      expect(sourceDate.value).toBe(transaction.date);
      expect(sourceDate.source.content).toMatch(/^(06|07)-\d{2}$/);
      expect(transaction.date.endsWith(sourceDate.source.content)).toBe(true);
    }
  });

  it("keeps transaction source boxes tied to the generated row index", () => {
    const sample = readJson<HomepageSourcesSample>(samplePath);
    const previousTopByPage = new Map<number, number>();

    for (const [
      index,
      transaction,
    ] of sample.extraction.transactions.entries()) {
      const source = sample.sources.transactions[index];
      const dateAnchor = source.date.source.anchor;
      const descriptionAnchor = source.description.source.anchor;
      const amountAnchor = source.amount.source.anchor;

      expect(transaction.date).toBe(expectedTransactionDate(index));
      expect(source.date.value).toBe(transaction.date);
      expect(dateAnchor.page).toBe(pageForTransaction(index));
      expect(descriptionAnchor.page).toBe(dateAnchor.page);
      expect(amountAnchor.page).toBe(dateAnchor.page);

      expect(dateAnchor.left).toBeLessThan(descriptionAnchor.left);
      expect(descriptionAnchor.left).toBeLessThan(amountAnchor.left);
      expect(descriptionAnchor.top).toBe(dateAnchor.top);
      expect(amountAnchor.top).toBe(dateAnchor.top);

      const previousTop = previousTopByPage.get(dateAnchor.page);
      if (previousTop !== undefined)
        expect(dateAnchor.top).toBeGreaterThan(previousTop);
      previousTopByPage.set(dateAnchor.page, dateAnchor.top);
    }
  });

  it("keeps the registry artifact in sync", () => {
    const sample = readJson<Record<string, unknown>>(samplePath);
    const registry = readJson<{
      files: Array<{ path: string; content: string }>;
    }>(registryPath);
    const bundledSample = registry.files.find(
      (file) =>
        file.path === "components/viewers/sample-data/json-form-sources.json",
    );

    expect(bundledSample).toBeDefined();
    expect(JSON.parse(bundledSample!.content)).toEqual(sample);
  });
});
