const JSON_DEFAULT_TEXT_CLASS_NAME = "text-foreground/70";
const JSON_INSPECTOR_HTML_CACHE_LIMIT = 4_096;

type JsonInspectorTokenSpan = {
  className: string;
  end: number;
  start: number;
  text: string;
};

type JsonInspectorHighlightPattern = {
  className: string;
  regex: RegExp;
};

export type JsonInspectorLineHtmlCache = {
  get(line: string): string;
  readonly size: number;
};

const JSON_HIGHLIGHT_PATTERNS: readonly JsonInspectorHighlightPattern[] = [
  {
    regex: /"([^"]+)"(?=\s*:)/g,
    className: "text-violet-600 dark:text-violet-400",
  },
  { regex: /"([^"]*)"/g, className: "text-amber-700 dark:text-amber-400" },
  {
    regex: /\b(true|false)\b/g,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  { regex: /\bnull\b/g, className: "text-muted-foreground" },
  {
    regex: /\b(\d+\.?\d*)\b/g,
    className: "text-blue-600 dark:text-blue-400",
  },
];

export function createJsonInspectorLineHtmlCache(
  maxSize = JSON_INSPECTOR_HTML_CACHE_LIMIT,
): JsonInspectorLineHtmlCache {
  const cache = new Map<string, string>();
  const limit = Math.max(1, Math.floor(maxSize));

  return {
    get(line) {
      const cached = cache.get(line);
      if (cached !== undefined) {
        cache.delete(line);
        cache.set(line, cached);
        return cached;
      }

      const html = jsonInspectorLineToHtml(line);
      cache.set(line, html);
      while (cache.size > limit) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return html;
    },
    get size() {
      return cache.size;
    },
  };
}

export function jsonInspectorLineToHtml(line: string): string {
  const spans = jsonInspectorTokenSpans(line);
  if (spans.length === 0) {
    return spanToHtml(JSON_DEFAULT_TEXT_CLASS_NAME, line);
  }

  spans.sort((a, b) => a.start - b.start);
  let html = "";
  let lastEnd = 0;

  for (const span of spans) {
    if (span.start > lastEnd) {
      html += spanToHtml(
        JSON_DEFAULT_TEXT_CLASS_NAME,
        line.slice(lastEnd, span.start),
      );
    }
    html += spanToHtml(span.className, span.text);
    lastEnd = span.end;
  }

  if (lastEnd < line.length) {
    html += spanToHtml(JSON_DEFAULT_TEXT_CLASS_NAME, line.slice(lastEnd));
  }

  return html;
}

function jsonInspectorTokenSpans(line: string): JsonInspectorTokenSpan[] {
  const spans: JsonInspectorTokenSpan[] = [];

  for (const { regex, className } of JSON_HIGHLIGHT_PATTERNS) {
    const re = new RegExp(regex.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = spans.some(
        (span) => start < span.end && end > span.start,
      );
      if (!overlaps) {
        spans.push({ start, end, className, text: match[0] });
      }
    }
  }

  return spans;
}

function spanToHtml(className: string, text: string) {
  return `<span class="${className}">${escapeJsonInspectorHtml(text)}</span>`;
}

function escapeJsonInspectorHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
