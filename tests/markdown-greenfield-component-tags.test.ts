import { describe, expect, it } from "vitest"

import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document"
import type {
  MarkdownHastElement,
  MarkdownHastNode,
} from "@/registry/new-york-v4/ui/markdown-hast-types"

function collectComponents(
  node: MarkdownHastNode,
  out: MarkdownHastElement[] = []
) {
  const element = node as MarkdownHastElement
  if (element && element.type === "element") {
    if (
      element.properties &&
      "dataPretextComponentName" in element.properties
    ) {
      out.push(element)
    }
    for (const child of element.children ?? []) collectComponents(child, out)
  }
  return out
}

function documentText(node: MarkdownHastNode): string {
  if ((node as { type?: string }).type === "text") {
    return (node as { value: string }).value
  }
  const element = node as MarkdownHastElement
  return element.children ? element.children.map(documentText).join("") : ""
}

function components(markdown: string) {
  const document = createMarkdownGreenfieldDocument(markdown)
  const found = document.blocks.flatMap((block) =>
    block.hastChildren.flatMap((child) => collectComponents(child))
  )
  const text = document.blocks
    .map((block) => block.hastChildren.map(documentText).join(""))
    .join("")
  return {
    names: found.map((element) =>
      String(element.properties?.dataPretextComponentName)
    ),
    text,
  }
}

describe("pretext markdown consecutive component tags", () => {
  it("renders consecutive component tags (no blank line) as separate components", () => {
    const result = components(
      [
        '<Metric label="Parse accuracy" value="99.2%" />',
        '<Metric label="Mounted chunks" value="small window" />',
        '<Badge label="Stable" tone="success" /> <Badge label="Watch" tone="warning" /> <Badge label="Policy" tone="default" />',
      ].join("\n")
    )

    // CommonMark merges these into one HTML block; each tag must still render.
    expect(result.names).toEqual([
      "Metric",
      "Metric",
      "Badge",
      "Badge",
      "Badge",
    ])
    // None of the component syntax should leak through as literal text.
    expect(result.text).not.toMatch(/<(?:Metric|Badge)\b/)
  })

  it("parses component tags whose attribute values contain '>' (mermaid arrows)", () => {
    const single = components(
      '<Diagram type="mermaid" title="Flow" source="graph TD; A-->B" />'
    )
    expect(single.names).toEqual(["Diagram"])

    const consecutive = components(
      [
        '<Diagram type="mermaid" source="graph TD; A-->B" />',
        '<Diagram type="mermaid" source="graph LR; X-->Y" />',
      ].join("\n")
    )
    expect(consecutive.names).toEqual(["Diagram", "Diagram"])
  })

  it("renders valid sibling tags even when one tag in the run is invalid", () => {
    const result = components(
      '<Metric label="A" value="1" />\n<Badge label="B" tone="not-a-tone" />'
    )

    // The valid Metric still renders; the invalid Badge does not blank the run.
    expect(result.names).toEqual(["Metric"])
    expect(result.text).not.toMatch(/<Metric\b/)
  })
})
