import Prism from "prismjs";

import type { ViewerResource } from "@/lib/viewer-resource";

// A curated set of common languages ships by default. Add another by importing
// its Prism component here (or at your app entry) and adding a row to
// LANGUAGE_BY_EXTENSION:
//   import "prismjs/components/prism-kotlin"
//   const LANGUAGE_BY_EXTENSION = { ...; kt: "kotlin" }
//
// markup (html/xml), css, and javascript are part of Prism core. The order of
// these imports matters: tsx extends jsx + typescript, so both load first.
import "prismjs/components/prism-json";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-python";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-java";
import "prismjs/components/prism-markdown";

Prism.manual = true;

export type CodeTokenLeaf = {
  kind: string;
  text: string;
};

export type CodeSyntax = {
  identity: string;
  destroy?: () => void;
  getLineTokens(line: string): readonly CodeTokenLeaf[] | null;
};

export type CodeSyntaxOptions = {
  deferTokens?: boolean;
  onTokensChanged?: () => void;
};

const CODE_LINE_TOKENIZE_MAX = 2000;
const CODE_DEFERRED_TOKENIZE_BATCH_SIZE = 12;
const CODE_DEFERRED_TOKENIZE_BUDGET_MS = 6;

type CodeSyntaxIdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: Window["cancelIdleCallback"];
    requestIdleCallback?: Window["requestIdleCallback"];
  };

type CodeSyntaxTaskHandle =
  | { kind: "idle"; id: number }
  | { kind: "timeout"; id: number };

type CodeSyntaxTaskDeadline = {
  timeRemaining?: () => number;
};

// File extension -> Prism language id. The one piece of knowledge the viewer
// owns; Prism does not map extensions to languages. This is the single seam.
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  json: "json",
  json5: "json",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  py: "python",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  go: "go",
  rs: "rust",
  java: "java",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
};

// MIME -> Prism language id, used only for inline sources with no extension.
const LANGUAGE_BY_MIME: Record<string, string> = {
  "application/json": "json",
  "text/javascript": "javascript",
  "application/javascript": "javascript",
  "text/typescript": "typescript",
  "application/typescript": "typescript",
  "text/x-python": "python",
  "application/x-python": "python",
  "text/yaml": "yaml",
  "application/yaml": "yaml",
  "application/x-yaml": "yaml",
  "text/x-sh": "bash",
  "application/x-sh": "bash",
  "application/sql": "sql",
  "text/markdown": "markdown",
  "text/css": "css",
  "text/html": "markup",
  "application/xml": "markup",
  "text/xml": "markup",
};

export const CODE_VIEWER_SYNTAX_STYLE = `
.cv-token-comment { color: var(--cv-token-comment, #6e7781); font-style: italic; }
.cv-token-property,
.cv-token-tag,
.cv-token-attr-name,
.cv-token-symbol { color: var(--cv-token-property, #0550ae); }
.cv-token-string,
.cv-token-char,
.cv-token-attr-value,
.cv-token-url,
.cv-token-regex { color: var(--cv-token-string, #0a7d33); }
.cv-token-number { color: var(--cv-token-number, #b5690c); }
.cv-token-keyword,
.cv-token-boolean,
.cv-token-null,
.cv-token-constant,
.cv-token-atrule,
.cv-token-important { color: var(--cv-token-keyword, #8250df); }
.cv-token-function,
.cv-token-class-name,
.cv-token-builtin { color: var(--cv-token-function, #8250df); }
.cv-token-variable { color: var(--cv-token-variable, #953800); }
.cv-token-punctuation,
.cv-token-operator { color: var(--cv-token-punctuation, color-mix(in oklab, var(--foreground) 55%, transparent)); }
.dark .cv-token-comment { color: var(--cv-token-comment, #8b949e); }
.dark .cv-token-property,
.dark .cv-token-tag,
.dark .cv-token-attr-name,
.dark .cv-token-symbol { color: var(--cv-token-property, #6cb6ff); }
.dark .cv-token-string,
.dark .cv-token-char,
.dark .cv-token-attr-value,
.dark .cv-token-url,
.dark .cv-token-regex { color: var(--cv-token-string, #8ddb8c); }
.dark .cv-token-number { color: var(--cv-token-number, #e3b341); }
.dark .cv-token-keyword,
.dark .cv-token-boolean,
.dark .cv-token-null,
.dark .cv-token-constant,
.dark .cv-token-atrule,
.dark .cv-token-important { color: var(--cv-token-keyword, #dcbdfb); }
.dark .cv-token-function,
.dark .cv-token-class-name,
.dark .cv-token-builtin { color: var(--cv-token-function, #d2a8ff); }
.dark .cv-token-variable { color: var(--cv-token-variable, #ffa657); }
`;

export function createCodeSyntax(
  resource: ViewerResource,
  options: CodeSyntaxOptions = {},
): CodeSyntax {
  const languageId = codeLanguageId(resource);
  const grammar = languageId ? (Prism.languages[languageId] ?? null) : null;
  if (!languageId || !grammar) {
    return {
      identity: "plain",
      getLineTokens: () => null,
    };
  }
  const prismGrammar = grammar;

  const tokenCache = new Map<string, readonly CodeTokenLeaf[]>();
  const pendingLines = new Set<string>();
  let flushHandle: CodeSyntaxTaskHandle | null = null;
  let hasPendingTokenChanges = false;
  let isDestroyed = false;

  return {
    destroy: () => {
      isDestroyed = true;
      pendingLines.clear();
      if (flushHandle) {
        cancelCodeSyntaxTask(flushHandle);
        flushHandle = null;
      }
    },
    identity: languageId,
    getLineTokens: (line) => {
      if (line.length === 0 || line.length > CODE_LINE_TOKENIZE_MAX)
        return null;

      const cachedTokens = tokenCache.get(line);
      if (cachedTokens) return cachedTokens;

      if (options.deferTokens) {
        scheduleDeferredTokenization(line);
        return null;
      }

      const tokens = flattenCodeTokens(Prism.tokenize(line, prismGrammar));
      tokenCache.set(line, tokens);
      return tokens;
    },
  };

  function scheduleDeferredTokenization(line: string) {
    pendingLines.add(line);
    scheduleDeferredTokenFlush();
  }

  function scheduleDeferredTokenFlush() {
    if (flushHandle || isDestroyed) return;
    flushHandle = scheduleCodeSyntaxTask(flushDeferredTokenBatch);
  }

  function flushDeferredTokenBatch(deadline?: CodeSyntaxTaskDeadline) {
    flushHandle = null;
    if (isDestroyed) return;

    const startedAt = codeSyntaxNow();
    let processedLineCount = 0;
    while (pendingLines.size > 0) {
      const pendingLine = pendingLines.values().next().value;
      if (pendingLine == null) break;
      pendingLines.delete(pendingLine);

      if (!tokenCache.has(pendingLine)) {
        hasPendingTokenChanges = true;
        tokenCache.set(
          pendingLine,
          flattenCodeTokens(Prism.tokenize(pendingLine, prismGrammar)),
        );
      }

      processedLineCount += 1;
      if (
        shouldYieldDeferredTokenization({
          deadline,
          processedLineCount,
          startedAt,
        })
      ) {
        break;
      }
    }

    if (pendingLines.size > 0) {
      scheduleDeferredTokenFlush();
      return;
    }

    if (hasPendingTokenChanges) {
      hasPendingTokenChanges = false;
      options.onTokensChanged?.();
    }
  }
}

function scheduleCodeSyntaxTask(
  callback: (deadline?: CodeSyntaxTaskDeadline) => void,
): CodeSyntaxTaskHandle {
  const browserWindow = window as CodeSyntaxIdleWindow;
  if (browserWindow.requestIdleCallback) {
    return {
      kind: "idle",
      id: browserWindow.requestIdleCallback(callback, { timeout: 80 }),
    };
  }

  return {
    kind: "timeout",
    id: browserWindow.setTimeout(() => callback(), 0),
  };
}

function cancelCodeSyntaxTask(handle: CodeSyntaxTaskHandle) {
  const browserWindow = window as CodeSyntaxIdleWindow;
  if (handle.kind === "idle") {
    browserWindow.cancelIdleCallback?.(handle.id);
    return;
  }
  browserWindow.clearTimeout(handle.id);
}

function shouldYieldDeferredTokenization({
  deadline,
  processedLineCount,
  startedAt,
}: {
  deadline?: CodeSyntaxTaskDeadline;
  processedLineCount: number;
  startedAt: number;
}) {
  if (processedLineCount <= 0) return false;
  if (deadline?.timeRemaining && deadline.timeRemaining() <= 1) return true;
  if (processedLineCount >= CODE_DEFERRED_TOKENIZE_BATCH_SIZE) return true;
  return codeSyntaxNow() - startedAt >= CODE_DEFERRED_TOKENIZE_BUDGET_MS;
}

function codeSyntaxNow() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function codeLanguageId(resource: ViewerResource): string | null {
  const extension = resource.fileName.toLowerCase().split(".").pop();
  const byExtension = extension ? LANGUAGE_BY_EXTENSION[extension] : undefined;
  if (byExtension) return byExtension;

  const mimeType = resource.content.mimeType
    ?.toLowerCase()
    .split(";")[0]
    .trim();
  return (mimeType && LANGUAGE_BY_MIME[mimeType]) ?? null;
}

function flattenCodeTokens(
  tokens: Array<string | Prism.Token>,
  parentKind = "",
  leaves: CodeTokenLeaf[] = [],
): readonly CodeTokenLeaf[] {
  for (const token of tokens) {
    if (typeof token === "string") {
      leaves.push({ kind: parentKind, text: token });
    } else if (Array.isArray(token.content)) {
      flattenCodeTokens(
        token.content as Array<string | Prism.Token>,
        token.type,
        leaves,
      );
    } else if (typeof token.content === "string") {
      leaves.push({ kind: token.type, text: token.content });
    } else {
      flattenCodeTokens([token.content as Prism.Token], token.type, leaves);
    }
  }
  return leaves;
}
