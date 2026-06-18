// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MarkdownViewer } from "@/components/ui/markdown-viewer"
import { MarkdownGreenfieldChunkRenderer } from "@/registry/new-york-v4/ui/markdown-greenfield-renderer"

function markdownSource(text: string) {
  return {
    kind: "text" as const,
    fileName: "images.md",
    mimeType: "text/markdown",
    text,
  }
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("pretext markdown greenfield images", () => {
  it("renders images in a stable loading surface before decode", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '![Evidence](https://example.com/evidence.png "Source image")'
        )}
      />
    )

    const image = screen.getByRole("img", { name: "Evidence" })
    const figure = image.closest("figure")

    expect(figure?.getAttribute("data-pretext-image-src")).toBe(
      "https://example.com/evidence.png"
    )
    expect(figure?.getAttribute("data-pretext-image-state")).toBe("loading")
    expect(figure?.querySelector("[data-pretext-image-frame]")).toBeTruthy()
    expect(screen.getByText("Source image")).toBeTruthy()

    fireEvent.load(image)

    expect(figure?.getAttribute("data-pretext-image-state")).toBe("ready")
  })

  it("requests chunk measurement again after image decode changes state", async () => {
    const onContentReady = vi.fn()
    render(
      <MarkdownGreenfieldChunkRenderer
        chunk={
          {
            hastChildren: [
              {
                type: "element",
                tagName: "p",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "img",
                    properties: {
                      alt: "Evidence",
                      dataPretextMarkdownImage: "",
                      src: "https://example.com/evidence.png",
                    },
                    children: [],
                  },
                ],
              },
            ],
            id: "chunk-image",
            isHostile: false,
          } as any
        }
        onContentReady={onContentReady}
      />
    )
    const callsBeforeLoad = onContentReady.mock.calls.length

    fireEvent.load(screen.getByRole("img", { name: "Evidence" }))

    await waitFor(() => {
      expect(onContentReady.mock.calls.length).toBeGreaterThan(callsBeforeLoad)
    })
  })

  it("uses explicit image dimensions as placeholder metadata before decode", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Image src="https://example.com/chart.png" alt="Chart" width={640} height={360} title="Chart dimensions" />'
        )}
      />
    )

    const image = screen.getByRole("img", { name: "Chart" })
    const figure = image.closest("figure")
    const frame = figure?.querySelector<HTMLElement>(
      "[data-pretext-image-frame]"
    )

    expect(figure?.getAttribute("data-pretext-image-width")).toBe("640")
    expect(figure?.getAttribute("data-pretext-image-height")).toBe("360")
    expect(figure?.style.aspectRatio).toBe("640 / 360")
    expect(frame?.style.aspectRatio).toBe("640 / 360")
  })

  it("allows restricted Image components to provide stable dimensions", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          '<Image src="https://example.com/component.png" alt="Component image" width={320} height={180} />'
        )}
      />
    )

    const image = screen.getByRole("img", { name: "Component image" })
    const figure = image.closest("figure")

    expect(figure?.getAttribute("data-pretext-component")).toBe("Image")
    expect(figure?.getAttribute("data-pretext-image-width")).toBe("320")
    expect(figure?.getAttribute("data-pretext-image-height")).toBe("180")
    expect(figure?.style.aspectRatio).toBe("320 / 180")
  })

  it("keeps failed images measurable and announces the load failure", () => {
    render(
      <MarkdownViewer
        controls={false}
        source={markdownSource("![Broken](https://example.com/missing.png)")}
      />
    )

    const image = screen.getByRole("img", { name: "Broken" })
    const figure = image.closest("figure")
    fireEvent.error(image)

    expect(figure?.getAttribute("data-pretext-image-state")).toBe("failed")
    expect(screen.getByRole("alert").textContent).toBe(
      "Could not load image: Broken"
    )
  })

  it("blocks unsafe image URLs before they reach the DOM", () => {
    const { container } = render(
      <MarkdownViewer
        controls={false}
        source={markdownSource(
          [
            "![Script](javascript:alert(1))",
            "",
            "![Svg](https://example.com/diagram.svg)",
          ].join("\n")
        )}
      />
    )

    expect(container.querySelectorAll("img")).toHaveLength(0)
    expect(screen.getByRole("img", { name: "Script" })).toBeTruthy()
    expect(screen.getByRole("img", { name: "Svg" })).toBeTruthy()
  })
})
