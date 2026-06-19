import { describe, expect, it } from "vitest";

import {
  createCsvNormalizer,
  createCsvParser,
  extensionOfDelimitedName,
  inferCsvDialect,
  normalizeCsvDelimiter,
  parseCsv,
  resolveCsvDialect,
} from "@/registry/new-york-v4/lib/csv";
import {
  defaultCsvDownloadName,
  escapeDelimitedField,
  serializeCsvTable,
} from "@/registry/new-york-v4/ui/csv-viewer-download";
import {
  compareCsvCells,
  isNumericCell,
  sortedRowOrder,
} from "@/registry/new-york-v4/ui/csv-viewer-sort";

function feed(chunks: string[], delimiter?: string) {
  const parser = createCsvParser(delimiter ? { delimiter } : undefined);
  const out: string[][] = [];
  for (const c of chunks) out.push(...parser.push(c));
  out.push(...parser.flush());
  return out;
}

const parse1 = (text: string, delimiter?: string) => feed([text], delimiter);

// ---------------------------------------------------------------------------
// createCsvParser: field/record boundaries
// ---------------------------------------------------------------------------

describe("createCsvParser field boundaries", () => {
  it("keeps empty fields between delimiters", () => {
    expect(parse1("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("keeps a leading empty field", () => {
    expect(parse1(",a")).toEqual([["", "a"]]);
  });

  it("keeps a trailing empty field after a delimiter", () => {
    expect(parse1("a,b,")).toEqual([["a", "b", ""]]);
  });

  it("emits an all-empty record for a line of delimiters", () => {
    expect(parse1(",,")).toEqual([["", "", ""]]);
  });

  it("supports a custom single-character delimiter", () => {
    expect(parse1("a;b;c", ";")).toEqual([["a", "b", "c"]]);
  });

  it("treats the comma literally under a non-comma delimiter", () => {
    expect(parse1("a,b;c", ";")).toEqual([["a,b", "c"]]);
  });
});

// ---------------------------------------------------------------------------
// createCsvParser: quoting rules (RFC 4180-ish)
// ---------------------------------------------------------------------------

describe("createCsvParser quoting", () => {
  it("only opens a quoted field at the start of a field", () => {
    // A quote in the middle of an unquoted field is a literal character.
    expect(parse1('h\nab"cd')).toEqual([["h"], ['ab"cd']]);
  });

  it("keeps a bare quote next to a delimiter literal", () => {
    expect(parse1('x,y"z,w')).toEqual([["x", 'y"z', "w"]]);
  });

  it("merges characters that follow a closing quote into the same field", () => {
    expect(parse1('"ab"cd')).toEqual([["abcd"]]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parse1('"a""b"')).toEqual([['a"b']]);
  });

  it("treats an unterminated quote as consuming the rest of the input", () => {
    expect(parse1('"a,b')).toEqual([["a,b"]]);
    expect(parse1('"a\nb')).toEqual([["a\nb"]]);
  });

  it("preserves CRLF and LF inside quoted fields without normalizing them", () => {
    expect(parse1('"a\r\nb"')).toEqual([["a\r\nb"]]);
    expect(parse1('"a\nb"')).toEqual([["a\nb"]]);
  });

  it("keeps a delimiter inside a quoted field", () => {
    expect(parse1('"a,b,c"')).toEqual([["a,b,c"]]);
  });
});

// ---------------------------------------------------------------------------
// createCsvParser: line endings
// ---------------------------------------------------------------------------

describe("createCsvParser line endings", () => {
  it("treats a bare CR as a record separator", () => {
    expect(parse1("a\rb\rc")).toEqual([["a"], ["b"], ["c"]]);
  });

  it("treats CRLF as a single record separator", () => {
    expect(parse1("a\r\nb")).toEqual([["a"], ["b"]]);
  });

  it("handles mixed CRLF and LF endings in one document", () => {
    expect(parse1("a\r\nb\nc\rd")).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("does not emit a phantom record for a single trailing newline", () => {
    expect(parse1("a\nb\n")).toEqual([["a"], ["b"]]);
    expect(parse1("a\nb\r\n")).toEqual([["a"], ["b"]]);
  });

  it("emits a record for a blank line between records", () => {
    expect(parse1("a\n\nb")).toEqual([["a"], [""], ["b"]]);
  });
});

// ---------------------------------------------------------------------------
// createCsvParser: flush idempotence
// ---------------------------------------------------------------------------

describe("createCsvParser flush", () => {
  it("returns nothing on a second flush", () => {
    const parser = createCsvParser();
    parser.push("a,b");
    expect(parser.flush()).toEqual([["a", "b"]]);
    expect(parser.flush()).toEqual([]);
  });

  it("flushes an empty parser to nothing", () => {
    expect(createCsvParser().flush()).toEqual([]);
  });

  it("continues parsing after a chunk that ends exactly on a record boundary", () => {
    const parser = createCsvParser();
    expect(parser.push("a,b\n")).toEqual([["a", "b"]]);
    expect(parser.push("c,d")).toEqual([]);
    expect(parser.flush()).toEqual([["c", "d"]]);
  });
});

// ---------------------------------------------------------------------------
// parseCsv: shapes
// ---------------------------------------------------------------------------

describe("parseCsv shapes", () => {
  it("returns no rows for a header-only document", () => {
    expect(parseCsv("a,b,c")).toEqual({ columns: ["a", "b", "c"], rows: [] });
  });

  it("does not trim surrounding whitespace from fields", () => {
    const { rows } = parseCsv("h\n  spaced  ");
    expect(rows).toEqual([["  spaced  "]]);
  });

  it("pads earlier narrow rows once a later row widens the table", () => {
    expect(parseCsv("a\n1\n2,3,4")).toEqual({
      columns: ["a", "", ""],
      rows: [
        ["1", "", ""],
        ["2", "3", "4"],
      ],
    });
  });

  it("synthesizes widened column names when there is no header", () => {
    expect(parseCsv("1\n2,3", { hasHeader: false })).toEqual({
      columns: ["Column 1", "Column 2"],
      rows: [
        ["1", ""],
        ["2", "3"],
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// createCsvNormalizer: column growth naming
// ---------------------------------------------------------------------------

describe("createCsvNormalizer column growth", () => {
  it("names widened columns blank when the first record was a header", () => {
    const normalizer = createCsvNormalizer({ hasHeader: true });
    expect(normalizer.accept(["a", "b"])).toEqual([
      { type: "columns", columns: ["a", "b"] },
    ]);
    expect(normalizer.accept(["1", "2", "3", "4"])).toEqual([
      { type: "columns", columns: ["a", "b", "", ""] },
      { type: "row", row: ["1", "2", "3", "4"] },
    ]);
  });

  it("names widened columns with positional labels when there is no header", () => {
    const normalizer = createCsvNormalizer({ hasHeader: false });
    expect(normalizer.accept(["1"])).toEqual([
      { type: "columns", columns: ["Column 1"] },
      { type: "row", row: ["1"] },
    ]);
    expect(normalizer.accept(["2", "3", "4"])).toEqual([
      { type: "columns", columns: ["Column 1", "Column 2", "Column 3"] },
      { type: "row", row: ["2", "3", "4"] },
    ]);
  });

  it("does not emit a columns event when a later record is narrower", () => {
    const normalizer = createCsvNormalizer({ hasHeader: true });
    normalizer.accept(["a", "b", "c"]);
    expect(normalizer.accept(["1"])).toEqual([
      { type: "row", row: ["1", "", ""] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// dialect inference
// ---------------------------------------------------------------------------

describe("extensionOfDelimitedName", () => {
  it.each([
    ["data.csv", "csv"],
    ["data.TSV", "tsv"],
    ["a/b/c/file.tsv", "tsv"],
    ["data.tsv?v=2", "tsv"],
    ["data.csv#frag", "csv"],
    ["archive.tar.gz", "gz"],
    ["noext", null],
    [".hidden", null],
    ["trailingdot.", ""],
  ])("extracts the extension of %s as %s", (name, expected) => {
    expect(extensionOfDelimitedName(name)).toBe(expected);
  });
});

describe("inferCsvDialect", () => {
  it("infers tab from a .tsv file name", () => {
    expect(inferCsvDialect({ fileName: "a.tsv" })).toEqual({
      delimiter: "\t",
      hasHeader: true,
    });
  });

  it("infers comma from a .csv file name", () => {
    expect(inferCsvDialect({ fileName: "a.csv" }).delimiter).toBe(",");
  });

  it("infers tab from a tab-separated-values mime type with parameters", () => {
    expect(
      inferCsvDialect({ mimeType: "text/tab-separated-values; charset=utf-8" })
        .delimiter,
    ).toBe("\t");
  });

  it("prefers the file extension over the mime type", () => {
    expect(
      inferCsvDialect({
        fileName: "a.csv",
        mimeType: "text/tab-separated-values",
      }).delimiter,
    ).toBe(",");
  });

  it("falls back to comma for unknown descriptors", () => {
    expect(inferCsvDialect({ fileName: "a.txt" }).delimiter).toBe(",");
    expect(inferCsvDialect({}).delimiter).toBe(",");
  });

  it("infers from a URL src with query parameters", () => {
    expect(
      inferCsvDialect({ src: "https://x.test/a.tsv?token=1" }).delimiter,
    ).toBe("\t");
  });
});

describe("resolveCsvDialect", () => {
  it("normalizes an escaped tab from the delimiter override", () => {
    expect(
      resolveCsvDialect({ delimiter: "\\t", descriptor: {} }).delimiter,
    ).toBe("\t");
  });

  it("lets an explicit delimiter override the inferred dialect", () => {
    expect(
      resolveCsvDialect({ delimiter: ";", descriptor: { fileName: "a.tsv" } })
        .delimiter,
    ).toBe(";");
  });

  it("lets an explicit hasHeader override the inferred dialect", () => {
    expect(
      resolveCsvDialect({
        hasHeader: false,
        descriptor: { fileName: "a.csv" },
      }),
    ).toEqual({ delimiter: ",", hasHeader: false });
  });

  it("normalizes an escaped tab carried on a dialect object", () => {
    expect(
      resolveCsvDialect({
        dialect: { delimiter: "\\t", hasHeader: true },
        descriptor: {},
      }),
    ).toEqual({ delimiter: "\t", hasHeader: true });
  });

  // Regression: an empty delimiter used to pass straight through. The parser
  // silently falls back to a comma (`delimiter || ","`), but the exporter would
  // quote every field (`"".includes("")` is always true) and join with nothing,
  // producing corrupt output. Resolution must never yield an empty delimiter.
  it("falls back to the inferred delimiter when the override is empty", () => {
    expect(resolveCsvDialect({ delimiter: "", descriptor: {} }).delimiter).toBe(
      ",",
    );
    expect(
      resolveCsvDialect({ delimiter: "", descriptor: { fileName: "a.tsv" } })
        .delimiter,
    ).toBe("\t");
  });

  it("falls back to a comma when a dialect object carries an empty delimiter", () => {
    expect(
      resolveCsvDialect({
        dialect: { delimiter: "", hasHeader: true },
        descriptor: {},
      }),
    ).toEqual({ delimiter: ",", hasHeader: true });
  });

  it("produces a valid export after resolving an empty delimiter", () => {
    const dialect = resolveCsvDialect({
      dialect: { delimiter: "", hasHeader: true },
      descriptor: {},
    });
    expect(
      serializeCsvTable({
        columns: ["a", "b"],
        sourceRows: [["1", "2"]],
        dialect,
      }),
    ).toBe("a,b\r\n1,2");
  });
});

describe("normalizeCsvDelimiter", () => {
  it("converts the escaped tab token to a real tab", () => {
    expect(normalizeCsvDelimiter("\\t")).toBe("\t");
  });

  it("passes other delimiters through unchanged", () => {
    expect(normalizeCsvDelimiter(",")).toBe(",");
    expect(normalizeCsvDelimiter(";")).toBe(";");
    expect(normalizeCsvDelimiter(undefined)).toBe(undefined);
  });
});

// ---------------------------------------------------------------------------
// export: escaping + serialization
// ---------------------------------------------------------------------------

describe("escapeDelimitedField", () => {
  it("quotes fields containing the delimiter", () => {
    expect(escapeDelimitedField("a,b", ",")).toBe('"a,b"');
  });

  it("does not quote a comma when the delimiter is a tab", () => {
    expect(escapeDelimitedField("a,b", "\t")).toBe("a,b");
    expect(escapeDelimitedField("a\tb", "\t")).toBe('"a\tb"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(escapeDelimitedField('a"b', ",")).toBe('"a""b"');
  });

  it("quotes fields containing CR or LF", () => {
    expect(escapeDelimitedField("a\nb", ",")).toBe('"a\nb"');
    expect(escapeDelimitedField("a\rb", ",")).toBe('"a\rb"');
  });

  it("leaves plain fields and surrounding whitespace untouched", () => {
    expect(escapeDelimitedField("plain", ",")).toBe("plain");
    expect(escapeDelimitedField("  spaced  ", ",")).toBe("  spaced  ");
  });

  it("renders null/undefined cells as empty", () => {
    expect(escapeDelimitedField(undefined as unknown as string, ",")).toBe("");
  });
});

describe("serializeCsvTable", () => {
  const comma = { delimiter: ",", hasHeader: true };
  const tab = { delimiter: "\t", hasHeader: true };

  it("joins rows with CRLF and a header line", () => {
    expect(
      serializeCsvTable({
        columns: ["a", "b"],
        sourceRows: [["1", "2"]],
        dialect: comma,
      }),
    ).toBe("a,b\r\n1,2");
  });

  it("pads short rows to the column count", () => {
    expect(
      serializeCsvTable({
        columns: ["a", "b", "c"],
        sourceRows: [["1"]],
        dialect: comma,
      }),
    ).toBe("a,b,c\r\n1,,");
  });

  it("truncates rows wider than the column count", () => {
    expect(
      serializeCsvTable({
        columns: ["a"],
        sourceRows: [["1", "2", "3"]],
        dialect: comma,
      }),
    ).toBe("a\r\n1");
  });

  it("serializes with a real tab delimiter for tab dialects", () => {
    expect(
      serializeCsvTable({
        columns: ["a", "b"],
        sourceRows: [["1", "2"]],
        dialect: tab,
      }),
    ).toBe("a\tb\r\n1\t2");
  });

  it("normalizes an escaped-tab dialect to a real tab", () => {
    expect(
      serializeCsvTable({
        columns: ["a", "b"],
        sourceRows: [["1", "2"]],
        dialect: { delimiter: "\\t", hasHeader: true },
      }),
    ).toBe("a\tb\r\n1\t2");
  });
});

describe("defaultCsvDownloadName", () => {
  it("uses a .csv name for comma dialects", () => {
    expect(defaultCsvDownloadName({ delimiter: ",", hasHeader: true })).toBe(
      "data.csv",
    );
  });

  it("uses a .tsv name for tab dialects", () => {
    expect(defaultCsvDownloadName({ delimiter: "\t", hasHeader: true })).toBe(
      "data.tsv",
    );
    expect(defaultCsvDownloadName({ delimiter: "\\t", hasHeader: true })).toBe(
      "data.tsv",
    );
  });
});

// ---------------------------------------------------------------------------
// export -> parse round trip (rectangular tables, >= 2 columns)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Characters chosen to stress quoting. Excludes the BOM (﻿), which the
// parser intentionally strips from the very first character of a document.
const CELL_CHARS = ["a", "Z", "5", " ", ",", '"', "\n", "\r", "\t", ";", "é"];

function randomCell(rand: () => number): string {
  const length = Math.floor(rand() * 5);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CELL_CHARS[Math.floor(rand() * CELL_CHARS.length)];
  }
  return out;
}

describe("serializeCsvTable -> parseCsv round trip", () => {
  it.each(["\t", ","])(
    "preserves rectangular tables (>=2 cols) under delimiter %j",
    (delimiter) => {
      const rand = mulberry32(delimiter === "," ? 1 : 2);
      const dialect = { delimiter, hasHeader: true };
      for (let trial = 0; trial < 200; trial++) {
        const columnCount = 2 + Math.floor(rand() * 4);
        const rowCount = Math.floor(rand() * 5);
        const columns = Array.from({ length: columnCount }, () =>
          randomCell(rand),
        );
        const sourceRows = Array.from({ length: rowCount }, () =>
          Array.from({ length: columnCount }, () => randomCell(rand)),
        );
        const serialized = serializeCsvTable({ columns, sourceRows, dialect });
        const reparsed = parseCsv(serialized, { delimiter });
        expect(reparsed.columns).toEqual(columns);
        expect(reparsed.rows).toEqual(sourceRows);
      }
    },
  );

  it("round-trips fields needing escaping", () => {
    const dialect = { delimiter: ",", hasHeader: true };
    const columns = ["id", "note"];
    const sourceRows = [
      ["1", 'has "quotes"'],
      ["2", "comma, inside"],
      ["3", "line\nbreak"],
      ["4", "carriage\rreturn"],
      ["5", "  spaced  "],
    ];
    const serialized = serializeCsvTable({ columns, sourceRows, dialect });
    expect(parseCsv(serialized)).toEqual({ columns, rows: sourceRows });
  });

  it("drops a trailing all-empty single-column row (documented CSV ambiguity)", () => {
    const dialect = { delimiter: ",", hasHeader: true };
    const serialized = serializeCsvTable({
      columns: ["only"],
      sourceRows: [[""]],
      dialect,
    });
    // The exported text is "only\r\n" which is indistinguishable from a
    // header-only file with a trailing newline.
    expect(serialized).toBe("only\r\n");
    expect(parseCsv(serialized).rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sort comparator: total order + numeric handling
// ---------------------------------------------------------------------------

describe("isNumericCell", () => {
  it.each([
    ["1", true],
    ["-3.5", true],
    ["1e3", true],
    ["0", true],
    ["", false],
    ["abc", false],
    ["12a", false],
  ])("classifies %j as numeric=%s", (value, expected) => {
    expect(isNumericCell(value)).toBe(expected);
  });

  // Characterization tests: numeric detection delegates to `Number()`, which is
  // surprisingly permissive. These pin the current behavior so any deliberate
  // change to numeric detection is a conscious one. Empty (but not blank)
  // strings are excluded explicitly; everything else mirrors `Number()`.
  it.each([
    [" ", true], // Number(" ") === 0
    ["  5  ", true], // surrounding whitespace is ignored
    ["0x10", true], // hex literal -> 16
    ["0b101", true], // binary literal -> 5
    [".5", true], // leading-dot decimal
    ["Infinity", true], // Number("Infinity") === Infinity
    ["1_000", false], // numeric separators are not accepted
    ["1,000", false], // thousands separators are not numbers
    ["NaN", false], // Number("NaN") is NaN -> not numeric
  ])("treats %j as numeric=%s (matches Number())", (value, expected) => {
    expect(isNumericCell(value)).toBe(expected);
  });
});

describe("compareCsvCells", () => {
  it("orders numbers numerically, not lexicographically", () => {
    expect(compareCsvCells("9", "10")).toBeLessThan(0);
    expect(compareCsvCells("100", "9")).toBeGreaterThan(0);
  });

  it("handles negatives and decimals", () => {
    expect(compareCsvCells("-5", "3")).toBeLessThan(0);
    expect(compareCsvCells("1.5", "1.25")).toBeGreaterThan(0);
  });

  it("sorts text lexicographically", () => {
    expect(compareCsvCells("apple", "banana")).toBeLessThan(0);
  });

  it("sorts every numeric value ahead of every text value", () => {
    expect(compareCsvCells("999", "abc")).toBeLessThan(0);
    expect(compareCsvCells("abc", "0")).toBeGreaterThan(0);
  });

  it("is antisymmetric and transitive over mixed values (total order)", () => {
    // The previous implementation switched between numeric and lexicographic
    // comparison per-pair, which made it intransitive (e.g. 5a < 9 < 10 < 5a).
    const pool = [
      "9",
      "10",
      "5a",
      "100",
      "-2",
      "2.5",
      "abc",
      "Abc",
      "",
      "1e3",
      "z",
      "0",
    ];
    for (const a of pool) {
      for (const b of pool) {
        // Antisymmetry: sign(cmp(a,b)) + sign(cmp(b,a)) === 0.
        expect(
          Math.sign(compareCsvCells(a, b)) + Math.sign(compareCsvCells(b, a)),
        ).toBe(0);
        for (const c of pool) {
          if (compareCsvCells(a, b) <= 0 && compareCsvCells(b, c) <= 0) {
            expect(compareCsvCells(a, c)).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it("produces the same sorted order regardless of the input permutation", () => {
    const base = ["9", "10", "5a", "abc", "-2", "100"];
    const permutations = [
      ["9", "10", "5a", "abc", "-2", "100"],
      ["100", "-2", "abc", "5a", "10", "9"],
      ["5a", "9", "100", "abc", "10", "-2"],
      ["abc", "100", "9", "-2", "5a", "10"],
    ];
    const expected = base.slice().sort(compareCsvCells);
    for (const permutation of permutations) {
      expect(permutation.slice().sort(compareCsvCells)).toEqual(expected);
    }
  });
});

describe("sortedRowOrder", () => {
  const rows = [
    ["10", "b"],
    ["2", "a"],
    ["33", "c"],
  ];

  it("returns ascending source indices for a numeric column", () => {
    expect(sortedRowOrder(rows, 0, false)).toEqual([1, 0, 2]);
  });

  it("reverses for descending", () => {
    expect(sortedRowOrder(rows, 0, true)).toEqual([2, 0, 1]);
  });

  it("sorts a text column lexicographically", () => {
    expect(sortedRowOrder(rows, 1, false)).toEqual([1, 0, 2]);
  });

  it("treats missing cells as empty strings without throwing", () => {
    const ragged = [["b"], [], ["a"]];
    expect(() => sortedRowOrder(ragged, 0, false)).not.toThrow();
    // "" sorts before non-empty text; "a" before "b".
    expect(sortedRowOrder(ragged, 0, false)).toEqual([1, 2, 0]);
  });

  it("preserves input order for equal numeric values (stable ascending)", () => {
    const tied = [
      ["1", "first"],
      ["1.0", "second"],
      ["1", "third"],
    ];
    expect(sortedRowOrder(tied, 0, false)).toEqual([0, 1, 2]);
  });
});
