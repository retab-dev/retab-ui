// @vitest-environment jsdom

// Behavioral edge-case coverage for the text viewer's rendering surface:
// line splitting/counting fidelity, gutter sizing, highlight boundaries, the
// `bare` chrome variant, default download naming, and zoom display rounding.
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import { TextViewer } from "@/registry/new-york-v4/ui/text-viewer"
import {
  clearTextViewerResourceCacheForTests,
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "@/registry/new-york-v4/ui/text-viewer-resource"

function textSource(text: string, fileName?: string) {
  return { kind: "text" as const, text, fileName }
}

function mockObjectUrls(url = "blob:download") {
  const createObjectURL = vi.fn((_blob: Blob) => url)
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  })
  return { createObjectURL, revokeObjectURL }
}

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = []
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({
        href: this.getAttribute("href"),
        download: this.download,
      })
    })
  return { click, clicks }
}

function lineNumbers(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll("[data-line-number]"))
    .map((node) => Number(node.getAttribute("data-line-number")))
    .sort((a, b) => a - b)
}

function lineText(container: HTMLElement, lineNumber: number): string | null {
  return (
    container.querySelector(
      `[data-line-number="${lineNumber}"] span:last-child`
    )?.textContent ?? null
  )
}

function gutterWidth(container: HTMLElement, lineNumber: number): string | null {
  const gutter = container.querySelector<HTMLElement>(
    `[data-line-number="${lineNumber}"] span:first-child`
  )
  return gutter?.style.width ?? null
}

function frameClassName(container: HTMLElement): string {
  return (
    container.querySelector('[data-slot="text-viewer"]')?.className ?? ""
  )
}

beforeEach(() => {
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  clearTextViewerResourceCacheForTests()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function readResourceAfterSuspense(
  args: Parameters<typeof readTextResource>[0]
) {
  try {
    return readTextResource(args)
  } catch (thrown) {
    if (thrown instanceof Promise) {
      await thrown.catch(() => undefined)
      return readTextResource(args)
    }
    throw thrown
  }
}

describe("line splitting and counting fidelity", () => {
  it("keeps the toolbar count, splitTextLines, and rendered rows consistent for mixed newlines", () => {
    const text = "a\nb\r\nc\rd"
    const { container } = render(<TextViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual(["a", "b", "c", "d"])
    expect(screen.getByText("4 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3, 4])
    expect(lineText(container, 1)).toBe("a")
    expect(lineText(container, 4)).toBe("d")
  })

  it("preserves runs of consecutive blank lines as addressable rows", () => {
    const { container } = render(
      <TextViewer source={textSource("a\n\n\nb")} />
    )

    expect(screen.getByText("4 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3, 4])
    // Blank interior lines still render a (non-collapsing) row.
    expect(container.querySelector('[data-line-number="2"]')).toBeTruthy()
    expect(container.querySelector('[data-line-number="3"]')).toBeTruthy()
    expect(lineText(container, 1)).toBe("a")
    expect(lineText(container, 4)).toBe("b")
  })

  it("treats a trailing CRLF as one extra blank final line", () => {
    const { container } = render(
      <TextViewer source={textSource("alpha\r\n")} />
    )

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2])
    expect(lineText(container, 1)).toBe("alpha")
  })

  it("does not treat lone CR as part of CRLF when followed by a non-newline", () => {
    const text = "a\r\rb"
    const { container } = render(<TextViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual(["a", "", "b"])
    expect(screen.getByText("3 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3])
  })

  // Characterization: only CR/LF/CRLF are treated as line breaks. Unicode
  // separators (LINE SEPARATOR U+2028, PARAGRAPH SEPARATOR U+2029, NEL U+0085)
  // and form-feed / vertical-tab are NOT split. NOTE: CSS `white-space: pre`
  // *does* force a visual break on U+2028/U+2029, so in a real browser the
  // gutter line numbers would not line up with the visually wrapped lines —
  // a latent source-linking inconsistency worth revisiting.
  it("does not split on Unicode line/paragraph separators or form/vertical tabs", () => {
    const text = "a b cd\fe\vf"
    const { container } = render(<TextViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual([text])
    expect(screen.getByText("1 line")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1])
  })
})

describe("rendering fidelity", () => {
  it("preserves leading whitespace and tab characters in line content", () => {
    const { container } = render(
      <TextViewer source={textSource("\t\tindented\n    spaced")} />
    )

    expect(lineText(container, 1)).toBe("\t\tindented")
    expect(lineText(container, 2)).toBe("    spaced")
  })

  it("renders a row for a whitespace-only line", () => {
    const { container } = render(
      <TextViewer source={textSource("a\n   \nb")} />
    )

    expect(lineText(container, 2)).toBe("   ")
  })

  it("renders contiguous, gap-free line numbers starting at 1", () => {
    const { container } = render(
      <TextViewer
        source={textSource(
          Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n")
        )}
        toolbar={false}
      />
    )

    const numbers = lineNumbers(container)
    expect(numbers[0]).toBe(1)
    for (let i = 1; i < numbers.length; i++) {
      expect(numbers[i]).toBe(numbers[i - 1] + 1)
    }
  })
})

describe("gutter sizing", () => {
  it("widens the gutter as the line-count digit width grows (9 -> 10)", () => {
    const nine = render(
      <TextViewer
        source={textSource(Array.from({ length: 9 }, () => "x").join("\n"))}
        toolbar={false}
      />
    )
    // 1 digit + 1 padding char.
    expect(gutterWidth(nine.container, 1)).toBe("2ch")
    cleanup()

    const ten = render(
      <TextViewer
        source={textSource(Array.from({ length: 10 }, () => "x").join("\n"))}
        toolbar={false}
      />
    )
    // 2 digits + 1 padding char.
    expect(gutterWidth(ten.container, 1)).toBe("3ch")
  })

  it("uses a 2ch gutter for a single empty line", () => {
    const { container } = render(<TextViewer source={textSource("")} />)
    expect(gutterWidth(container, 1)).toBe("2ch")
  })
})

describe("highlight boundaries", () => {
  it("truncates fractional highlight bounds before clamping", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo\nthree\nfour")}
        highlight={{ start: 1.9, end: 2.9 }}
      />
    )

    expect(
      container.querySelector('[data-line-number="1"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="2"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="3"]')?.className
    ).not.toContain("bg-primary/12")
  })

  it("highlights the final line when the range ends exactly at the line count", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: 3, end: 3 }}
      />
    )

    expect(
      container.querySelector('[data-line-number="3"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="2"]')?.className
    ).not.toContain("bg-primary/12")
  })

  it("clamps a range that overruns the document end", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: 2, end: 99 }}
      />
    )

    expect(
      container.querySelector('[data-line-number="1"]')?.className
    ).not.toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="2"]')?.className
    ).toContain("bg-primary/12")
    expect(
      container.querySelector('[data-line-number="3"]')?.className
    ).toContain("bg-primary/12")
  })

  it("does not highlight a zero/negative range entirely before line 1", () => {
    const { container } = render(
      <TextViewer
        source={textSource("one\ntwo")}
        highlight={{ start: -3, end: 0 }}
      />
    )

    expect(container.querySelector(".bg-primary\\/12")).toBeNull()
  })

  it("highlights the only line of a single-line document", () => {
    const { container } = render(
      <TextViewer source={textSource("solo")} highlight={{ start: 1, end: 1 }} />
    )

    expect(
      container.querySelector('[data-line-number="1"]')?.className
    ).toContain("bg-primary/12")
  })
})

describe("bare chrome variant", () => {
  it("drops the border/rounded shell and fills its container when bare", () => {
    const { container } = render(
      <TextViewer source={textSource("alpha")} bare />
    )

    const className = frameClassName(container)
    expect(className).toContain("h-full")
    expect(className).toContain("bg-muted/20")
    expect(className).not.toContain("rounded-xl")
    expect(className).not.toContain("border")
  })

  it("keeps the bordered shell by default", () => {
    const { container } = render(<TextViewer source={textSource("alpha")} />)

    const className = frameClassName(container)
    expect(className).toContain("rounded-xl")
    expect(className).toContain("border")
    expect(className).toContain("bg-muted/30")
  })
})

describe("download naming defaults", () => {
  it("falls back to text.txt when inline text has no file name", async () => {
    mockObjectUrls("blob:default-name")
    const { clicks } = captureAnchorClicks()

    render(<TextViewer source={textSource("no name here")} />)

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() =>
      expect(clicks).toEqual([
        { href: "blob:default-name", download: "text.txt" },
      ])
    )
  })

  it("falls back to file for a blob source without a file name", async () => {
    mockObjectUrls("blob:default-blob")
    const { clicks } = captureAnchorClicks()

    render(
      <TextViewer
        source={blobSource(new Blob(["blob body"], { type: "text/plain" }), {
          identityKey: "blob:no-name",
        })}
      />
    )

    await screen.findByText("blob body")
    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    await waitFor(() =>
      expect(clicks).toEqual([{ href: "blob:default-blob", download: "file" }])
    )
  })
})

describe("zoom display rounding", () => {
  it("rounds the displayed zoom percentage at each step", () => {
    render(<TextViewer source={textSource("alpha")} />)

    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom in"))
    expect(screen.getByText("144%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Reset zoom"))
    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Zoom out"))
    expect(screen.getByText("83%")).toBeTruthy()
  })

  it("keeps font and line-height metrics in sync with the zoom level", () => {
    const { container } = render(<TextViewer source={textSource("alpha")} />)
    const pre = container.querySelector("pre")

    fireEvent.click(screen.getByLabelText("Zoom out"))

    // 12 / 1.2 and 20 / 1.2.
    expect(pre?.style.fontSize).toBe("10px")
    expect(pre?.style.lineHeight).toBe(`${20 / 1.2}px`)
  })
})

// The URL/blob byte limit measures *transferred* bytes, not the re-encoded
// decoded text. Invalid UTF-8 decodes to U+FFFD (3 bytes each); counting that
// would inflate the size and falsely reject small resources as "too large".
// Regression coverage for that fix: a 1-byte body must pass a 1-byte limit even
// though its decoded form would re-encode to 3 bytes.
describe("resource byte accounting counts wire bytes, not decode inflation", () => {
  it("accepts a 1-byte invalid-UTF-8 URL body against a 1-byte limit", async () => {
    // One 0xFF byte on the wire; decodes to U+FFFD which re-encodes to 3 bytes.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([0xff]))))
    )

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource({ kind: "url", url: "/invalid-utf8.bin" })
          .content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 1 }),
      })
    ).resolves.toBe("�")
  })

  it("accepts an invalid-UTF-8 blob body whose decode would re-inflate", async () => {
    await expect(
      readResourceAfterSuspense({
        content: createViewerResource(
          blobSource(new Uint8Array([0xff]), { identityKey: "blob:invalid" })
        ).content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 1 }),
      })
    ).resolves.toBe("�")
  })

  it("still rejects a body whose transferred bytes exceed the limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(new Uint8Array([0xff, 0xff, 0xff, 0xff])))
      )
    )

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource({ kind: "url", url: "/too-many-bytes.bin" })
          .content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).rejects.toThrow("bytes limit")
  })
})
