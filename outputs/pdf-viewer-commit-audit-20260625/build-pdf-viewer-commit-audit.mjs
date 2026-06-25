import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = "/Users/sachaichbiah/Local/retab-ui";
const outputDir = path.join(repoRoot, "outputs/pdf-viewer-commit-audit-20260625");
const gitBin =
  "/Users/sachaichbiah/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/git";
const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const since = "2026-06-10 00:00:00";
const until = "2026-06-25 23:59:59";

const pdfViewerCorePathspecs = [
  "registry/new-york-v4/ui/pdf-viewer*",
  "components/ui/pdf-viewer*",
  "apps/v4/registry/new-york-v4/ui/pdf-viewer*",
  "apps/v4/components/ui/pdf-viewer*",
  "registry/new-york-v4/ui/use-pdf-page-metrics.ts",
  "components/ui/use-pdf-page-metrics.ts",
  "apps/v4/registry/new-york-v4/ui/use-pdf-page-metrics.ts",
  "apps/v4/components/ui/use-pdf-page-metrics.ts",
  "registry/new-york-v4/lib/pdf-viewer-diagnostics.ts",
  "lib/pdf-viewer-diagnostics.ts",
  "apps/v4/registry/new-york-v4/lib/pdf-viewer-diagnostics.ts",
  "apps/v4/lib/pdf-viewer-diagnostics.ts",
];

const pdfRelatedPathspecs = [
  ...pdfViewerCorePathspecs,
  "app/(view)/pdf-viewer-benchmark/**",
  "apps/v4/app/(view)/pdf-viewer-benchmark/**",
  "components/pdf-viewer-demo.tsx",
  "apps/v4/components/pdf-viewer-demo.tsx",
  "components/file-thumbnail/renderers/pdf-thumbnail.tsx",
  "apps/v4/components/file-thumbnail/renderers/pdf-thumbnail.tsx",
  "components/ui/pdf-source.tsx",
  "components/ui/pdf-thumbnail*",
  "apps/v4/components/ui/pdf-source.tsx",
  "apps/v4/components/ui/pdf-thumbnail*",
  "content/docs/components/file-viewer/renderers/pdf.mdx",
  "content/docs/components/file-viewer/navigation/file-viewer-thumbnails.mdx",
  "apps/v4/content/docs/components/file-viewer/renderers/pdf.mdx",
  "apps/v4/content/docs/components/file-viewer/navigation/file-viewer-thumbnails.mdx",
  "design/pdf-viewer*",
  "public/r/pdf*.json",
  "apps/v4/public/r/pdf*.json",
  "registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
  "registry/new-york-v4/ui/pdf-source.tsx",
  "registry/new-york-v4/ui/pdf-thumbnail*",
  "apps/v4/registry/new-york-v4/blocks/pdf-thumbnails-block.tsx",
  "apps/v4/registry/new-york-v4/ui/pdf-source.tsx",
  "apps/v4/registry/new-york-v4/ui/pdf-thumbnail*",
  "tests/pdf-*.ts",
  "tests/pdf-*.tsx",
  "apps/v4/tests/pdf-*.ts",
  "apps/v4/tests/pdf-*.tsx",
];

const importantTokens = [
  "devicePixelRatio",
  "PDF_PAGE_SCROLLING_MAX_DEVICE_PIXEL_RATIO",
  "PDF_PAGE_SETTLED_MAX_DEVICE_PIXEL_RATIO",
  "getPdfPageDevicePixelRatio",
  "usePdfPageRenderScheduler",
  "PDF_PAGE_RENDER_CONCURRENCY",
  "PDF_SCROLLING_PAGE_RENDER_CONCURRENCY",
  "usePdfRenderedPageCache",
  "readPdfRenderedPageCache",
  "writePdfRenderedPageCache",
  "usePdfScrollActivity",
  "isScrolling",
  "scrollDirection",
  "renderPageNumbers",
  "preloadPageNumbers",
  "requestPageMetrics",
  "usePdfPageMetrics",
  "createRoot",
  "projectPdfPages",
  "disposePdfPageProjectionCache",
  "PageSkeleton",
  "IntersectionObserver",
  "ResizeObserver",
  "scrollToPageArea",
  "capturePdfReadingAnchor",
  "restorePdfReadingAnchor",
  "renderedPageCache",
  "directionAwarePreRender",
  "performanceOptions",
  "markCanvasRenderStatus",
  "renderTask.cancel",
];

function git(args, options = {}) {
  return execFileSync(gitBin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  });
}

function csvEscape(value) {
  if (value == null) return "";
  const text = String(value).replace(/\r?\n/g, " | ");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function truncateCell(value, max = 30000) {
  if (value == null) return "";
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, max - 32)} ... [truncated]`;
}

function parseNumstat(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const additions = parts[0] === "-" ? 0 : Number(parts[0]);
    const deletions = parts[1] === "-" ? 0 : Number(parts[1]);
    const filePath = normalizeDiffPath(parts.slice(2).join("\t"));
    rows.push({
      additions: Number.isFinite(additions) ? additions : 0,
      deletions: Number.isFinite(deletions) ? deletions : 0,
      loc: (Number.isFinite(additions) ? additions : 0) +
        (Number.isFinite(deletions) ? deletions : 0),
      path: filePath,
    });
  }
  return rows;
}

function parseNameStatus(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0];
    const filePath = normalizeDiffPath(parts[parts.length - 1] ?? "");
    rows.push({ status, path: filePath, raw: line });
  }
  return rows;
}

function normalizeDiffPath(filePath) {
  return filePath
    .replace(/^"|"$/g, "")
    .replace(/\{([^{}]+) => ([^{}]+)\}/g, "$2")
    .replace(/.* => /, "")
    .trim();
}

function sumStats(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.files += 1;
      acc.additions += row.additions;
      acc.deletions += row.deletions;
      acc.loc += row.loc;
      return acc;
    },
    { files: 0, additions: 0, deletions: 0, loc: 0 },
  );
}

function isPdfViewerCorePath(filePath) {
  return (
    filePath.startsWith("registry/new-york-v4/ui/pdf-viewer") ||
    filePath.startsWith("components/ui/pdf-viewer") ||
    filePath.startsWith("apps/v4/registry/new-york-v4/ui/pdf-viewer") ||
    filePath.startsWith("apps/v4/components/ui/pdf-viewer") ||
    filePath === "registry/new-york-v4/ui/use-pdf-page-metrics.ts" ||
    filePath === "components/ui/use-pdf-page-metrics.ts" ||
    filePath === "apps/v4/registry/new-york-v4/ui/use-pdf-page-metrics.ts" ||
    filePath === "apps/v4/components/ui/use-pdf-page-metrics.ts" ||
    filePath === "registry/new-york-v4/lib/pdf-viewer-diagnostics.ts" ||
    filePath === "lib/pdf-viewer-diagnostics.ts" ||
    filePath === "apps/v4/registry/new-york-v4/lib/pdf-viewer-diagnostics.ts" ||
    filePath === "apps/v4/lib/pdf-viewer-diagnostics.ts"
  );
}

function isPdfRelatedPath(filePath) {
  return (
    isPdfViewerCorePath(filePath) ||
    filePath.includes("pdf-viewer") ||
    filePath.includes("pdf-thumbnail") ||
    filePath.includes("pdf-source") ||
    filePath.startsWith("tests/pdf-") ||
    filePath.startsWith("public/r/pdf") ||
    filePath === "components/pdf-viewer-demo.tsx" ||
    filePath === "content/docs/components/file-viewer/renderers/pdf.mdx" ||
    filePath === "content/docs/components/file-viewer/navigation/file-viewer-thumbnails.mdx"
  );
}

function fileCategory(filePath) {
  if (/pdf-viewer-content\.tsx$/.test(filePath)) return "viewer composition";
  if (/pdf-viewer-page\.tsx$/.test(filePath)) return "page canvas rendering";
  if (/pdf-viewer-scale\.ts$/.test(filePath)) return "zoom / DPR";
  if (/pdf-viewer-scroll\.ts$/.test(filePath)) return "scroll state";
  if (/pdf-viewer-virtualization\.ts$/.test(filePath)) return "virtualization";
  if (/pdf-viewer-layout\.ts$/.test(filePath)) return "layout geometry";
  if (/pdf-viewer-render-scheduler\.ts$/.test(filePath)) return "render scheduler";
  if (/pdf-viewer-render-cache\.ts$/.test(filePath)) return "render cache";
  if (/use-pdf-page-metrics\.ts$/.test(filePath)) return "page metrics";
  if (/pdf-viewer-types\.ts$/.test(filePath)) return "public types";
  if (/pdf-viewer\.tsx$/.test(filePath)) return "viewer entrypoint";
  if (/pdf-viewer-canvas\.ts$/.test(filePath)) return "canvas sizing";
  if (/pdf-viewer-states\.tsx$/.test(filePath)) return "loading / error states";
  if (/pdf-viewer-thumbnails|pdf-thumbnail/.test(filePath)) return "thumbnail UI";
  if (/pdf-source/.test(filePath)) return "PDF source overlays";
  if (filePath.startsWith("tests/")) return "tests";
  if (filePath.startsWith("public/r/")) return "registry output";
  if (filePath.startsWith("app/(view)/pdf-viewer-benchmark")) return "benchmark";
  if (filePath.startsWith("design/")) return "design notes";
  if (filePath.startsWith("content/docs/")) return "docs";
  return "PDF related";
}

function repoArea(filePath) {
  if (filePath.startsWith("registry/new-york-v4/ui/")) return "registry ui";
  if (filePath.startsWith("registry/new-york-v4/blocks/")) return "registry blocks";
  if (filePath.startsWith("components/ui/")) return "components ui";
  if (filePath.startsWith("components/")) return "components";
  if (filePath.startsWith("app/homepage/")) return "homepage";
  if (filePath.startsWith("app/(view)/")) return "view routes";
  if (filePath.startsWith("content/docs/")) return "docs";
  if (filePath.startsWith("public/r/")) return "registry json";
  if (filePath.startsWith("tests/")) return "tests";
  if (filePath.startsWith("design/")) return "design";
  if (filePath.startsWith("lib/")) return "lib";
  if (filePath.startsWith("scripts/")) return "scripts";
  return filePath.split("/")[0] || "(root)";
}

function summarizeAreas(numstatRows) {
  const counts = new Map();
  for (const row of numstatRows) {
    const area = repoArea(row.path);
    const current = counts.get(area) ?? { files: 0, loc: 0 };
    current.files += 1;
    current.loc += row.loc;
    counts.set(area, current);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].loc - a[1].loc)
    .slice(0, 8)
    .map(([area, stats]) => `${area}: ${stats.files} files / ${stats.loc} LOC`)
    .join("; ");
}

function unique(values, max = 30) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function extractSymbols(lines) {
  const symbols = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[+-]/, "").trim();
    const patterns = [
      /\bexport\s+function\s+([A-Za-z0-9_$]+)/,
      /\bfunction\s+([A-Za-z0-9_$]+)/,
      /\bexport\s+const\s+([A-Za-z0-9_$]+)/,
      /\bconst\s+([A-Za-z0-9_$]+)\s*=/,
      /\bexport\s+type\s+([A-Za-z0-9_$]+)/,
      /\btype\s+([A-Za-z0-9_$]+)\s*=/,
      /\bexport\s+interface\s+([A-Za-z0-9_$]+)/,
      /\binterface\s+([A-Za-z0-9_$]+)/,
      /\bclass\s+([A-Za-z0-9_$]+)/,
    ];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        symbols.push(match[1]);
        break;
      }
    }
    const importMatch = line.match(/^import .* from ["']([^"']+)["']/);
    if (importMatch) symbols.push(`import ${importMatch[1]}`);
  }
  return unique(symbols, 20);
}

function extractConstants(lines) {
  return unique(
    lines
      .map((line) => line.replace(/^[+-]/, "").trim())
      .map((line) => line.match(/\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]+)\b/)?.[1])
      .filter(Boolean),
    20,
  );
}

function parsePdfDiff(diffText) {
  const files = [];
  let current = null;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current) files.push(current);
      const match = line.match(/ b\/(.+)$/);
      current = {
        path: normalizeDiffPath(match?.[1] ?? ""),
        hunks: [],
        addedLines: [],
        removedLines: [],
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("@@")) {
      current.hunks.push(line.replace(/^@@[^@]*@@\s*/, "").trim());
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) current.addedLines.push(line);
    if (line.startsWith("-")) current.removedLines.push(line);
  }
  if (current) files.push(current);

  return files.map((file) => {
    const changedText = [...file.addedLines, ...file.removedLines].join("\n");
    const tokens = importantTokens.filter((token) => changedText.includes(token));
    return {
      ...file,
      addedSymbols: extractSymbols(file.addedLines),
      removedSymbols: extractSymbols(file.removedLines),
      addedConstants: extractConstants(file.addedLines),
      removedConstants: extractConstants(file.removedLines),
      importantTokens: tokens,
      hunkContexts: unique(file.hunks.filter(Boolean), 20),
      addedPreview: previewLines(file.addedLines),
      removedPreview: previewLines(file.removedLines),
    };
  });
}

function previewLines(lines) {
  return unique(
    lines
      .map((line) => line.replace(/^[+-]/, "").trim())
      .filter((line) => line && !line.startsWith("import type"))
      .filter((line) => line.length > 2)
      .slice(0, 12),
    12,
  ).join("\n");
}

function buildPdfBehaviorSummary(files, commit) {
  if (files.length === 0) return "No PDF viewer path changes.";
  const paths = files.map((file) => file.path).join("\n");
  const allTokens = new Set(files.flatMap((file) => file.importantTokens));
  const categories = new Set(files.map((file) => fileCategory(file.path)));
  const notes = [];

  if (
    allTokens.has("PDF_PAGE_SCROLLING_MAX_DEVICE_PIXEL_RATIO") ||
    allTokens.has("getPdfPageDevicePixelRatio") ||
    allTokens.has("isScrolling")
  ) {
    notes.push(
      "Introduced or changed scrolling-vs-settled rendering quality/DPR behavior.",
    );
  }
  if (allTokens.has("usePdfPageRenderScheduler")) {
    notes.push("Added or modified page render scheduling/concurrency.");
  }
  if (allTokens.has("usePdfRenderedPageCache") || allTokens.has("writePdfRenderedPageCache")) {
    notes.push("Added or modified canvas render cache reuse.");
  }
  if (allTokens.has("createRoot") || allTokens.has("projectPdfPages")) {
    notes.push("Changed page projection to manually managed React roots.");
  }
  if (allTokens.has("renderPageNumbers") || allTokens.has("preloadPageNumbers")) {
    notes.push("Separated visible pages from render/preload windows.");
  }
  if (allTokens.has("usePdfPageMetrics") || allTokens.has("requestPageMetrics")) {
    notes.push("Added async page metric preloading for page sizes.");
  }
  if (allTokens.has("usePdfScrollActivity") || allTokens.has("scrollDirection")) {
    notes.push("Added scroll activity/direction tracking.");
  }
  if (allTokens.has("capturePdfReadingAnchor") || allTokens.has("restorePdfReadingAnchor")) {
    notes.push("Changed scroll anchor preservation across layout changes.");
  }
  if (categories.has("layout geometry")) notes.push("Changed page layout geometry model.");
  if (categories.has("virtualization")) notes.push("Changed page virtualization/windowing.");
  if (categories.has("scroll state")) notes.push("Changed page scroll tracking/navigation.");
  if (categories.has("tests")) notes.push("Updated PDF tests.");
  if (categories.has("registry output")) notes.push("Regenerated registry JSON output.");
  if (categories.has("docs")) notes.push("Updated PDF docs.");
  if (categories.has("benchmark")) notes.push("Updated PDF benchmark harness.");

  if (notes.length === 0) {
    notes.push(
      `Touched PDF-related categories: ${[...categories].sort().join(", ")}.`,
    );
  }
  if (commit.short === "5ed850e") {
    notes.unshift(
      "Likely blink regression point: first focused commit that caps scrolling DPR and re-renders settled pages.",
    );
  }
  if (commit.short === "8a9060b") {
    notes.unshift(
      "Earlier broad optimization point: replaces observer/DOM measurement with layout-model virtualization.",
    );
  }
  if (commit.short === "ccc7236") {
    notes.unshift(
      "Follow-up amplification: adds render cache, scroll activity and manual projection on top of the DPR split.",
    );
  }
  if (commit.short === "400aaf3") {
    notes.unshift(
      "Later tuning: raises scrolling render concurrency and cache size while keeping the DPR split.",
    );
  }

  return `${unique(notes, 12).join(" ")} Files: ${paths}`;
}

function regressionRelevance(commit, pdfCoreStats, pdfRelatedStats, behaviorSummary) {
  if (commit.short === "5ed850e") {
    return "P0 likely blink cause: introduces scrolling DPR cap and settled high-DPR rerender.";
  }
  if (commit.short === "ccc7236") {
    return "P1 likely worsener: adds cache/projection/scroll-activity around the optimized render path.";
  }
  if (commit.short === "400aaf3") {
    return "P1 follow-up: changes scrolling render concurrency/cache size; likely affects blink timing, not root cause.";
  }
  if (commit.short === "8a9060b") {
    return "P2 earlier baseline shift: major virtualization/layout optimization before the DPR blink existed.";
  }
  if (pdfCoreStats.loc > 500) return "P2 large PDF core change; inspect if reverting beyond focused fix.";
  if (/DPR|render scheduling|render cache|manual/i.test(behaviorSummary)) {
    return "P2 behavior-adjacent PDF rendering change.";
  }
  if (pdfCoreStats.loc > 0) return "P3 PDF core touched, but no obvious low/high-res mechanism.";
  if (pdfRelatedStats.loc > 0) return "P4 PDF-adjacent only.";
  return "No PDF relevance.";
}

function diffForCommit(base, sha, pathspecs) {
  return git([
    "diff",
    "--unified=0",
    "--find-renames",
    "--find-copies",
    base,
    sha,
    "--",
    ...pathspecs,
  ]);
}

function readCommitMetadata(sha) {
  const raw = git([
    "show",
    "-s",
    "--format=%H%x1f%h%x1f%aI%x1f%an%x1f%ae%x1f%P%x1f%s%x1f%b%x1e",
    sha,
  ]);
  const record = raw.replace(/\x1e\s*$/, "");
  const [full, short, authoredAt, authorName, authorEmail, parents, subject, body] =
    record.split("\x1f");
  return {
    full,
    short,
    authoredAt,
    authorName,
    authorEmail,
    parents: parents ? parents.split(" ").filter(Boolean) : [],
    subject,
    body: body?.trim() ?? "",
  };
}

function getChangedFilesText(rows, maxFiles = 35) {
  const fileTexts = rows
    .sort((a, b) => b.loc - a.loc)
    .slice(0, maxFiles)
    .map((row) => `${row.path} (+${row.additions}/-${row.deletions})`);
  const omitted = rows.length > maxFiles ? `\n... ${rows.length - maxFiles} more files` : "";
  return fileTexts.join("\n") + omitted;
}

function getStatusForPath(nameStatusRows, filePath) {
  const hit = nameStatusRows.find((row) => row.path === filePath);
  return hit?.status ?? "";
}

function dayFromIso(iso) {
  return iso.slice(0, 10);
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function makeMatrix(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => truncateCell(row[header] ?? "")))];
}

function writeSheet(workbook, sheetName, headers, rows, options = {}) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  const matrix = makeMatrix(headers, rows);
  const range = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
  range.values = matrix;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(options.freezeColumns ?? 0);

  const headerRange = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  headerRange.format.fill = { color: options.headerFill ?? "#111827" };
  headerRange.format.font = { color: "#FFFFFF", bold: true };
  headerRange.format.wrapText = true;
  headerRange.format.rowHeightPx = 34;

  if (matrix.length > 1) {
    const body = sheet.getRangeByIndexes(1, 0, matrix.length - 1, headers.length);
    body.format.font = { color: "#111827", size: 10 };
    body.format.wrapText = true;
    body.format.borders = {
      insideHorizontal: { style: "thin", color: "#E5E7EB" },
    };
  }

  for (let col = 0; col < headers.length; col += 1) {
    const width = options.widths?.[headers[col]] ?? 140;
    sheet.getRangeByIndexes(0, col, matrix.length, 1).format.columnWidthPx = width;
  }

  return sheet;
}

const commitShas = git([
  "log",
  "--reverse",
  "--since",
  since,
  "--until",
  until,
  "--pretty=format:%H",
  "HEAD",
])
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const commitRows = [];
const pdfCommitRows = [];
const pdfFileRows = [];
const suspicionRows = [];
const allPdfCategories = new Map();
const daily = new Map();

for (let index = 0; index < commitShas.length; index += 1) {
  const sha = commitShas[index];
  const commit = readCommitMetadata(sha);
  const base = commit.parents[0] ?? emptyTree;
  const diffBasis =
    commit.parents.length === 0
      ? "root"
      : commit.parents.length > 1
        ? "first parent of merge"
        : "parent";
  const numstatRows = parseNumstat(
    git(["diff", "--numstat", "--find-renames", "--find-copies", base, sha]),
  );
  const nameStatusRows = parseNameStatus(
    git(["diff", "--name-status", "--find-renames", "--find-copies", base, sha]),
  );
  const totalStats = sumStats(numstatRows);
  const pdfCoreRows = numstatRows.filter((row) => isPdfViewerCorePath(row.path));
  const pdfRelatedRows = numstatRows.filter((row) => isPdfRelatedPath(row.path));
  const pdfCoreStats = sumStats(pdfCoreRows);
  const pdfRelatedStats = sumStats(pdfRelatedRows);
  const pdfDiffText =
    pdfRelatedRows.length > 0 ? diffForCommit(base, sha, pdfRelatedPathspecs) : "";
  const pdfDiffFiles = parsePdfDiff(pdfDiffText);
  const behaviorSummary = buildPdfBehaviorSummary(pdfDiffFiles, commit);
  const relevance = regressionRelevance(
    commit,
    pdfCoreStats,
    pdfRelatedStats,
    behaviorSummary,
  );
  const changedAreas = summarizeAreas(numstatRows);
  const pdfCategories = unique(
    pdfRelatedRows.map((row) => fileCategory(row.path)).sort(),
    30,
  );
  for (const category of pdfCategories) {
    allPdfCategories.set(category, (allPdfCategories.get(category) ?? 0) + 1);
  }

  const day = dayFromIso(commit.authoredAt);
  const dayStats = daily.get(day) ?? {
    date: day,
    commits: 0,
    pdf_commits: 0,
    repo_loc_changed: 0,
    pdf_viewer_path_loc_changed: 0,
    pdf_related_loc_changed: 0,
    most_relevant_commits: [],
  };
  dayStats.commits += 1;
  dayStats.repo_loc_changed += totalStats.loc;
  dayStats.pdf_viewer_path_loc_changed += pdfCoreStats.loc;
  dayStats.pdf_related_loc_changed += pdfRelatedStats.loc;
  if (pdfRelatedStats.loc > 0) {
    dayStats.pdf_commits += 1;
    dayStats.most_relevant_commits.push(
      `${commit.short} ${commit.subject} (${pdfRelatedStats.loc} PDF-related LOC)`,
    );
  }
  daily.set(day, dayStats);

  const commitRow = {
    "#": index + 1,
    date: day,
    authored_at: commit.authoredAt,
    short_sha: commit.short,
    sha: commit.full,
    subject: commit.subject,
    body: commit.body,
    author: commit.authorName,
    parent_count: commit.parents.length,
    diff_basis: diffBasis,
    repo_files_changed: totalStats.files,
    repo_insertions: totalStats.additions,
    repo_deletions: totalStats.deletions,
    repo_loc_changed: totalStats.loc,
    repo_areas_changed: changedAreas,
    changed_files_top: getChangedFilesText(numstatRows),
    pdf_viewer_path_files_changed: pdfCoreStats.files,
    pdf_viewer_path_insertions: pdfCoreStats.additions,
    pdf_viewer_path_deletions: pdfCoreStats.deletions,
    pdf_viewer_path_loc_changed: pdfCoreStats.loc,
    pdf_related_files_changed: pdfRelatedStats.files,
    pdf_related_insertions: pdfRelatedStats.additions,
    pdf_related_deletions: pdfRelatedStats.deletions,
    pdf_related_loc_changed: pdfRelatedStats.loc,
    pdf_related_categories: pdfCategories.join("; "),
    pdf_related_files: getChangedFilesText(pdfRelatedRows, 40),
    pdf_behavior_summary: behaviorSummary,
    regression_relevance: relevance,
  };
  commitRows.push(commitRow);

  if (pdfRelatedRows.length > 0) {
    pdfCommitRows.push({
      date: day,
      authored_at: commit.authoredAt,
      short_sha: commit.short,
      subject: commit.subject,
      pdf_viewer_path_files_changed: pdfCoreStats.files,
      pdf_viewer_path_insertions: pdfCoreStats.additions,
      pdf_viewer_path_deletions: pdfCoreStats.deletions,
      pdf_viewer_path_loc_changed: pdfCoreStats.loc,
      pdf_related_files_changed: pdfRelatedStats.files,
      pdf_related_loc_changed: pdfRelatedStats.loc,
      pdf_related_categories: pdfCategories.join("; "),
      pdf_related_files: getChangedFilesText(pdfRelatedRows, 60),
      added_symbols: unique(pdfDiffFiles.flatMap((file) => file.addedSymbols), 50).join("; "),
      removed_symbols: unique(pdfDiffFiles.flatMap((file) => file.removedSymbols), 50).join("; "),
      added_constants: unique(pdfDiffFiles.flatMap((file) => file.addedConstants), 50).join("; "),
      removed_constants: unique(pdfDiffFiles.flatMap((file) => file.removedConstants), 50).join("; "),
      important_terms: unique(pdfDiffFiles.flatMap((file) => file.importantTokens), 50).join("; "),
      hunk_contexts: unique(pdfDiffFiles.flatMap((file) => file.hunkContexts), 60).join("; "),
      pdf_behavior_summary: behaviorSummary,
      regression_relevance: relevance,
    });
  }

  for (const row of pdfRelatedRows) {
    const diffFile = pdfDiffFiles.find((file) => file.path === row.path) ?? {
      addedSymbols: [],
      removedSymbols: [],
      addedConstants: [],
      removedConstants: [],
      importantTokens: [],
      hunkContexts: [],
      addedPreview: "",
      removedPreview: "",
    };
    pdfFileRows.push({
      date: day,
      short_sha: commit.short,
      subject: commit.subject,
      status: getStatusForPath(nameStatusRows, row.path),
      path: row.path,
      category: fileCategory(row.path),
      additions: row.additions,
      deletions: row.deletions,
      loc_changed: row.loc,
      added_symbols: diffFile.addedSymbols.join("; "),
      removed_symbols: diffFile.removedSymbols.join("; "),
      added_constants: diffFile.addedConstants.join("; "),
      removed_constants: diffFile.removedConstants.join("; "),
      important_terms: diffFile.importantTokens.join("; "),
      hunk_contexts: diffFile.hunkContexts.join("; "),
      added_line_preview: diffFile.addedPreview,
      removed_line_preview: diffFile.removedPreview,
    });
  }

  if (/^P[0-2]/.test(relevance)) {
    suspicionRows.push({
      priority: relevance.slice(0, 2),
      date: day,
      short_sha: commit.short,
      subject: commit.subject,
      pdf_viewer_path_loc_changed: pdfCoreStats.loc,
      pdf_related_loc_changed: pdfRelatedStats.loc,
      reason: relevance,
      behavior_summary: behaviorSummary,
      pdf_files: getChangedFilesText(pdfRelatedRows, 50),
    });
  }
}

const dailyRows = [...daily.values()].map((row) => ({
  ...row,
  most_relevant_commits: row.most_relevant_commits.slice(0, 12).join("\n"),
}));

const scopeRows = [
  {
    item: "Generated at",
    value: `Generated ${new Date().toISOString()}`,
  },
  {
    item: "Git range",
    value: `HEAD commits authored from ${since} through ${until}, chronological order.`,
  },
  {
    item: "Diff basis",
    value:
      "Each commit is diffed against its first parent. Root commits use the empty tree. Merge commits therefore show the net first-parent merge delta.",
  },
  {
    item: "PDF viewer path LOC",
    value: pdfViewerCorePathspecs.join("\n"),
  },
  {
    item: "PDF-related LOC",
    value: pdfRelatedPathspecs.join("\n"),
  },
  {
    item: "Important interpretation",
    value:
      "The PDF viewer path LOC columns are exact git numstat totals for the PDF viewer path definition above. The behavior summaries are generated from file names, symbols, constants, hunk contexts and important tokens in the PDF diffs.",
  },
  {
    item: "Main finding",
    value:
      "5ed850e is the focused low-res/high-res blink suspect: it introduces scrolling vs settled DPR caps and render scheduling. 8a9060b is the earlier broad optimization checkpoint.",
  },
];

const summaryCsvHeaders = [
  "#",
  "date",
  "authored_at",
  "short_sha",
  "sha",
  "subject",
  "author",
  "parent_count",
  "diff_basis",
  "repo_files_changed",
  "repo_insertions",
  "repo_deletions",
  "repo_loc_changed",
  "repo_areas_changed",
  "pdf_viewer_path_files_changed",
  "pdf_viewer_path_insertions",
  "pdf_viewer_path_deletions",
  "pdf_viewer_path_loc_changed",
  "pdf_related_files_changed",
  "pdf_related_loc_changed",
  "pdf_related_categories",
  "pdf_related_files",
  "pdf_behavior_summary",
  "regression_relevance",
];

const csvRows = [
  summaryCsvHeaders,
  ...commitRows.map((row) => summaryCsvHeaders.map((header) => row[header] ?? "")),
];
await fs.writeFile(
  path.join(outputDir, "pdf_viewer_commit_audit_2026-06-10_to_2026-06-25.csv"),
  toCsv(csvRows),
  "utf8",
);

const workbook = Workbook.create();

writeSheet(
  workbook,
  "Commit Summary",
  [
    "#",
    "date",
    "authored_at",
    "short_sha",
    "subject",
    "repo_files_changed",
    "repo_loc_changed",
    "repo_areas_changed",
    "changed_files_top",
    "pdf_viewer_path_files_changed",
    "pdf_viewer_path_insertions",
    "pdf_viewer_path_deletions",
    "pdf_viewer_path_loc_changed",
    "pdf_related_files_changed",
    "pdf_related_loc_changed",
    "pdf_related_categories",
    "pdf_related_files",
    "pdf_behavior_summary",
    "regression_relevance",
    "sha",
  ],
  commitRows,
  {
    freezeColumns: 4,
    widths: {
      "#": 48,
      date: 92,
      authored_at: 170,
      short_sha: 78,
      subject: 260,
      repo_files_changed: 92,
      repo_loc_changed: 92,
      repo_areas_changed: 280,
      changed_files_top: 360,
      pdf_viewer_path_files_changed: 108,
      pdf_viewer_path_insertions: 108,
      pdf_viewer_path_deletions: 108,
      pdf_viewer_path_loc_changed: 108,
      pdf_related_files_changed: 108,
      pdf_related_loc_changed: 108,
      pdf_related_categories: 220,
      pdf_related_files: 360,
      pdf_behavior_summary: 460,
      regression_relevance: 320,
      sha: 260,
    },
  },
);

writeSheet(
  workbook,
  "PDF Commit Details",
  [
    "date",
    "authored_at",
    "short_sha",
    "subject",
    "pdf_viewer_path_files_changed",
    "pdf_viewer_path_insertions",
    "pdf_viewer_path_deletions",
    "pdf_viewer_path_loc_changed",
    "pdf_related_files_changed",
    "pdf_related_loc_changed",
    "pdf_related_categories",
    "pdf_related_files",
    "added_symbols",
    "removed_symbols",
    "added_constants",
    "removed_constants",
    "important_terms",
    "hunk_contexts",
    "pdf_behavior_summary",
    "regression_relevance",
  ],
  pdfCommitRows,
  {
    freezeColumns: 3,
    headerFill: "#7C2D12",
    widths: {
      date: 92,
      authored_at: 170,
      short_sha: 78,
      subject: 260,
      pdf_viewer_path_files_changed: 105,
      pdf_viewer_path_insertions: 105,
      pdf_viewer_path_deletions: 105,
      pdf_viewer_path_loc_changed: 105,
      pdf_related_files_changed: 105,
      pdf_related_loc_changed: 105,
      pdf_related_categories: 220,
      pdf_related_files: 360,
      added_symbols: 320,
      removed_symbols: 320,
      added_constants: 260,
      removed_constants: 260,
      important_terms: 360,
      hunk_contexts: 420,
      pdf_behavior_summary: 500,
      regression_relevance: 340,
    },
  },
);

writeSheet(
  workbook,
  "PDF File Stats",
  [
    "date",
    "short_sha",
    "subject",
    "status",
    "path",
    "category",
    "additions",
    "deletions",
    "loc_changed",
    "added_symbols",
    "removed_symbols",
    "added_constants",
    "removed_constants",
    "important_terms",
    "hunk_contexts",
    "added_line_preview",
    "removed_line_preview",
  ],
  pdfFileRows,
  {
    freezeColumns: 5,
    headerFill: "#064E3B",
    widths: {
      date: 92,
      short_sha: 78,
      subject: 240,
      status: 70,
      path: 320,
      category: 160,
      additions: 80,
      deletions: 80,
      loc_changed: 90,
      added_symbols: 280,
      removed_symbols: 280,
      added_constants: 220,
      removed_constants: 220,
      important_terms: 300,
      hunk_contexts: 380,
      added_line_preview: 420,
      removed_line_preview: 420,
    },
  },
);

writeSheet(
  workbook,
  "Daily Totals",
  [
    "date",
    "commits",
    "pdf_commits",
    "repo_loc_changed",
    "pdf_viewer_path_loc_changed",
    "pdf_related_loc_changed",
    "most_relevant_commits",
  ],
  dailyRows,
  {
    freezeColumns: 1,
    headerFill: "#1E3A8A",
    widths: {
      date: 95,
      commits: 80,
      pdf_commits: 90,
      repo_loc_changed: 115,
      pdf_viewer_path_loc_changed: 140,
      pdf_related_loc_changed: 125,
      most_relevant_commits: 620,
    },
  },
);

writeSheet(
  workbook,
  "Suspicion Ranking",
  [
    "priority",
    "date",
    "short_sha",
    "subject",
    "pdf_viewer_path_loc_changed",
    "pdf_related_loc_changed",
    "reason",
    "behavior_summary",
    "pdf_files",
  ],
  suspicionRows,
  {
    freezeColumns: 3,
    headerFill: "#991B1B",
    widths: {
      priority: 70,
      date: 92,
      short_sha: 78,
      subject: 260,
      pdf_viewer_path_loc_changed: 125,
      pdf_related_loc_changed: 115,
      reason: 380,
      behavior_summary: 520,
      pdf_files: 440,
    },
  },
);

writeSheet(
  workbook,
  "Scope Notes",
  ["item", "value"],
  scopeRows,
  {
    freezeColumns: 1,
    headerFill: "#374151",
    widths: { item: 220, value: 820 },
  },
);

const overviewRows = [
  {
    metric: "Commits in date range",
    value: commitRows.length,
  },
  {
    metric: "Commits touching PDF viewer path",
    value: commitRows.filter((row) => row.pdf_viewer_path_loc_changed > 0).length,
  },
  {
    metric: "Commits touching PDF-related files",
    value: commitRows.filter((row) => row.pdf_related_loc_changed > 0).length,
  },
  {
    metric: "Total repo LOC changed",
    value: commitRows.reduce((sum, row) => sum + safeNumber(row.repo_loc_changed), 0),
  },
  {
    metric: "Total PDF viewer path LOC changed",
    value: commitRows.reduce(
      (sum, row) => sum + safeNumber(row.pdf_viewer_path_loc_changed),
      0,
    ),
  },
  {
    metric: "Total PDF-related LOC changed",
    value: commitRows.reduce((sum, row) => sum + safeNumber(row.pdf_related_loc_changed), 0),
  },
  {
    metric: "Most suspicious commit",
    value: "5ed850e - speed up pdf viewer",
  },
  {
    metric: "Earlier broad optimization commit",
    value: "8a9060b - optimize viewers",
  },
  {
    metric: "Most frequent PDF categories touched",
    value: [...allPdfCategories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => `${category}: ${count}`)
      .join("; "),
  },
];

writeSheet(
  workbook,
  "Overview",
  ["metric", "value"],
  overviewRows,
  {
    freezeColumns: 1,
    headerFill: "#111827",
    widths: { metric: 320, value: 760 },
  },
);

const keyRanges = [
  ["Overview", "A1:B12"],
  ["Commit Summary", "A1:T25"],
  ["PDF Commit Details", "A1:T25"],
  ["PDF File Stats", "A1:Q25"],
  ["Daily Totals", "A1:G18"],
  ["Suspicion Ranking", "A1:I25"],
  ["Scope Notes", "A1:B8"],
];

const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 5,
  tableMaxCols: 8,
});
await fs.writeFile(path.join(outputDir, "inspect.ndjson"), inspect.ndjson, "utf8");

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
await fs.writeFile(path.join(outputDir, "formula-error-scan.ndjson"), errors.ndjson, "utf8");

for (const [sheetName, range] of keyRanges) {
  const preview = await workbook.render({
    sheetName,
    range,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  await fs.writeFile(
    path.join(
      outputDir,
      `preview-${sheetName.toLowerCase().replaceAll(" ", "-")}.png`,
    ),
    bytes,
  );
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(
  path.join(outputDir, "pdf_viewer_commit_audit_2026-06-10_to_2026-06-25.xlsx"),
);

console.log(
  JSON.stringify(
    {
      commits: commitRows.length,
      pdfViewerPathCommits: commitRows.filter(
        (row) => row.pdf_viewer_path_loc_changed > 0,
      ).length,
      pdfRelatedCommits: commitRows.filter((row) => row.pdf_related_loc_changed > 0)
        .length,
      csv: path.join(
        outputDir,
        "pdf_viewer_commit_audit_2026-06-10_to_2026-06-25.csv",
      ),
      xlsx: path.join(
        outputDir,
        "pdf_viewer_commit_audit_2026-06-10_to_2026-06-25.xlsx",
      ),
    },
    null,
    2,
  ),
);
