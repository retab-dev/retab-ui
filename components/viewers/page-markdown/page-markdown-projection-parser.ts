import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { type PageMarkdownProjectionNode } from "@/components/viewers/page-markdown/page-markdown-projection-protocol";

let pageMarkdownProcessor: ReturnType<
  typeof createPageMarkdownProcessor
> | null = null;

export function createPageMarkdownProjectionTree(
  markdown: string,
): PageMarkdownProjectionNode {
  const processor = getPageMarkdownProcessor();
  const tree = processor.runSync(
    processor.parse(markdown),
  ) as PageMarkdownProjectionNode;
  escapeRawHtml(tree);
  return tree;
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

function escapeRawHtml(node: PageMarkdownProjectionNode) {
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
