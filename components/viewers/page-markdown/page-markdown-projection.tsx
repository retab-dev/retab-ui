"use client";

import * as React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { markdownComponents } from "@/components/viewers/page-markdown/page-markdown-components";

const PAGE_MARKDOWN_PROJECTION_CACHE_LIMIT = 160;

type PageMarkdownNode = {
  children?: PageMarkdownNode[];
  properties?: Record<string, unknown>;
  type: string;
  value?: unknown;
};

type PageMarkdownProjectionCacheEntry = {
  markdown: string;
  projection: React.ReactNode;
};

const pageMarkdownProjectionCache = new Map<
  string,
  PageMarkdownProjectionCacheEntry
>();

let pageMarkdownProcessor: ReturnType<
  typeof createPageMarkdownProcessor
> | null = null;

export function projectPageMarkdown(markdown: string): React.ReactNode {
  const cacheKey = pageMarkdownProjectionCacheKey(markdown);
  const cached = pageMarkdownProjectionCache.get(cacheKey);
  if (cached?.markdown === markdown) {
    pageMarkdownProjectionCache.delete(cacheKey);
    pageMarkdownProjectionCache.set(cacheKey, cached);
    return cached.projection;
  }

  const projection = createPageMarkdownProjection(markdown);
  pageMarkdownProjectionCache.set(cacheKey, { markdown, projection });
  while (
    pageMarkdownProjectionCache.size > PAGE_MARKDOWN_PROJECTION_CACHE_LIMIT
  ) {
    const oldestKey = pageMarkdownProjectionCache.keys().next().value;
    if (!oldestKey) break;
    pageMarkdownProjectionCache.delete(oldestKey);
  }
  return projection;
}

export function clearPageMarkdownProjectionCacheForTests() {
  pageMarkdownProjectionCache.clear();
}

export function isPlainPageMarkdown(markdown: string): boolean {
  if (!markdown.trim()) return true;
  if (
    /[`[\]\\~]|!\[|&[#a-zA-Z]|https?:\/\/|www\.|mailto:|\S+@\S+\.\S+/i.test(
      markdown,
    )
  ) {
    return false;
  }
  if (/[*_<>|]/.test(markdown)) return false;
  if (/ {2,}\n/.test(markdown)) return false;

  return markdown.split(/\r\n|[\n\r\u2028\u2029]/).every((line) => {
    if (/^(?: {4}|\t)/.test(line)) return false;
    return !/^\s{0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>\s|`{3,}|~{3,}|-{3,}\s*$|={3,}\s*$)/.test(
      line,
    );
  });
}

function createPageMarkdownProjection(markdown: string): React.ReactNode {
  if (isPlainPageMarkdown(markdown)) return projectPlainPageMarkdown(markdown);

  const processor = getPageMarkdownProcessor();
  const tree = processor.runSync(processor.parse(markdown)) as PageMarkdownNode;
  escapeRawHtml(tree);

  return toJsxRuntime(tree as never, {
    Fragment,
    components: markdownComponents as never,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true,
  });
}

function projectPlainPageMarkdown(markdown: string): React.ReactNode {
  const paragraphs = markdown
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) return null;

  return paragraphs.map((paragraph, index) => (
    <p key={index} className="my-2 leading-relaxed">
      {paragraph}
    </p>
  ));
}

function getPageMarkdownProcessor() {
  pageMarkdownProcessor ??= createPageMarkdownProcessor();
  return pageMarkdownProcessor;
}

function createPageMarkdownProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true });
}

function escapeRawHtml(node: PageMarkdownNode) {
  const children = node.children;
  if (!children) return;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    if (child.type === "raw") {
      children[index] = {
        type: "text",
        value: typeof child.value === "string" ? child.value : "",
      };
      continue;
    }
    escapeRawHtml(child);
  }
}

function pageMarkdownProjectionCacheKey(markdown: string): string {
  return `${markdown.length}:${hashPageMarkdown(markdown)}`;
}

function hashPageMarkdown(markdown: string): string {
  let hash = 0;
  for (let index = 0; index < markdown.length; index += 1) {
    hash = Math.imul(hash ^ markdown.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}
