import type { Node } from "unist"
import { visit } from "unist-util-visit"

const EMOJI_SHORTCODES: Record<string, string> = {
  "+1": "👍",
  "-1": "👎",
  check: "✅",
  heavy_check_mark: "✔️",
  sparkles: "✨",
  tada: "🎉",
  warning: "⚠️",
  white_check_mark: "✅",
  x: "❌",
}

const SKIPPED_TEXT_PARENTS = new Set([
  "delete",
  "html",
  "image",
  "imageReference",
  "inlineCode",
  "inlineMath",
  "link",
  "linkReference",
  "math",
])

export function remarkMarkdownProseTransforms() {
  return (tree: unknown) => {
    visit(tree as Node, "text", (visitedNode, _index, parent) => {
      const parentType = (parent as { type?: unknown } | undefined)?.type
      if (SKIPPED_TEXT_PARENTS.has(String(parentType))) return
      const node = visitedNode as { value?: string }
      if (typeof node.value !== "string" || node.value.length === 0) return
      node.value = transformEmojiShortcodes(transformTypography(node.value))
    })
  }
}

export function transformTypography(value: string) {
  return value
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\.\.\./g, "…")
    .replace(/<->/g, "↔")
    .replace(/<-/g, "←")
    .replace(/->/g, "→")
    .replace(/\b1\/2\b/g, "½")
    .replace(/\b1\/4\b/g, "¼")
    .replace(/\b3\/4\b/g, "¾")
    .replace(/(^|[\s([{])"([^"]+)"(?=$|[\s)\]},.!?:;])/g, "$1“$2”")
    .replace(/(^|[\s([{])'([^']+)'(?=$|[\s)\]},.!?:;])/g, "$1‘$2’")
    .replace(/(\p{Letter})'(\p{Letter})/gu, "$1’$2")
}

export function transformEmojiShortcodes(value: string) {
  return value.replace(/:([a-z0-9_+-]+):/gi, (match, name: string) => {
    return EMOJI_SHORTCODES[name.toLowerCase()] ?? match
  })
}
