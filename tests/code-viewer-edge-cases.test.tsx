// @vitest-environment jsdom

// Behavioral edge-case coverage for the code viewer's rendering surface:
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
import { CodeViewer } from "@/registry/new-york-v4/ui/code-viewer"
import {
  clearTextViewerResourceCacheForTests,
  readTextResource,
  resolvedTextViewerBounds,
  splitTextLines,
} from "@/registry/new-york-v4/ui/text-viewer-resource"

const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)
const NEL = String.fromCharCode(0x0085)

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

function gutterWidth(
  container: HTMLElement,
  lineNumber: number
): string | null {
  const gutter = container.querySelector<HTMLElement>(
    `[data-line-number="${lineNumber}"] span:first-child`
  )
  return gutter?.style.width ?? null
}

function gutterRail(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-code-gutter-rail]")
}

function lineRow(
  container: HTMLElement,
  lineNumber: number
): HTMLElement | null {
  return container.querySelector(`[data-line-number="${lineNumber}"]`)
}

function frameClassName(container: HTMLElement): string {
  return container.querySelector('[data-slot="code-viewer"]')?.className ?? ""
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
  it("keeps the controls count, splitTextLines, and rendered rows consistent for mixed newlines", () => {
    const text = "a\nb\r\nc\rd"
    const { container } = render(<CodeViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual(["a", "b", "c", "d"])
    expect(screen.getByText("4 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3, 4])
    expect(lineText(container, 1)).toBe("a")
    expect(lineText(container, 4)).toBe("d")
  })

  it("preserves runs of consecutive blank lines as addressable rows", () => {
    const { container } = render(<CodeViewer source={textSource("a\n\n\nb")} />)

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
      <CodeViewer source={textSource("alpha\r\n")} />
    )

    expect(screen.getByText("2 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2])
    expect(lineText(container, 1)).toBe("alpha")
  })

  it("does not treat lone CR as part of CRLF when followed by a non-newline", () => {
    const text = "a\r\rb"
    const { container } = render(<CodeViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual(["a", "", "b"])
    expect(screen.getByText("3 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3])
  })

  // CSS `white-space: pre` forces a visual break on LINE SEPARATOR (U+2028) and
  // PARAGRAPH SEPARATOR (U+2029), so the gutter must split on them too to keep
  // line numbers aligned with the rendered text. This is the ECMAScript
  // LineTerminator set (LF, CR, LS, PS).
  it("splits on Unicode LINE and PARAGRAPH separators like a pre block does", () => {
    const text = "a" + LS + "b" + PS + "c"
    const { container } = render(<CodeViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual(["a", "b", "c"])
    expect(screen.getByText("3 lines")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1, 2, 3])
    expect(lineText(container, 1)).toBe("a")
    expect(lineText(container, 2)).toBe("b")
    expect(lineText(container, 3)).toBe("c")
  })

  it("treats CR followed by a Unicode separator as two distinct breaks", () => {
    expect(splitTextLines("a\r" + LS + "b")).toEqual(["a", "", "b"])
  })

  // Form-feed, vertical-tab, and NEL are control characters that browsers do
  // NOT break on in `white-space: pre`, and they are not ECMAScript line
  // terminators — so the viewer must keep them on a single line.
  it("does not split on form-feed, vertical-tab, or NEL", () => {
    const text = "a\fb\vc" + NEL + "d"
    const { container } = render(<CodeViewer source={textSource(text)} />)

    expect(splitTextLines(text)).toEqual([text])
    expect(screen.getByText("1 line")).toBeTruthy()
    expect(lineNumbers(container)).toEqual([1])
  })
})

describe("rendering fidelity", () => {
  it("preserves leading whitespace and tab characters in line content", () => {
    const { container } = render(
      <CodeViewer source={textSource("\t\tindented\n    spaced")} />
    )

    expect(lineText(container, 1)).toBe("\t\tindented")
    expect(lineText(container, 2)).toBe("    spaced")
  })

  it("renders a row for a whitespace-only line", () => {
    const { container } = render(
      <CodeViewer source={textSource("a\n   \nb")} />
    )

    expect(lineText(container, 2)).toBe("   ")
  })

  it("renders contiguous, gap-free line numbers starting at 1", () => {
    const { container } = render(
      <CodeViewer
        source={textSource(
          Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n")
        )}
        controls={false}
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
      <CodeViewer
        source={textSource(Array.from({ length: 9 }, () => "x").join("\n"))}
        controls={false}
      />
    )
    // 1 digit + 1 spare char + horizontal gutter padding.
    expect(gutterWidth(nine.container, 1)).toBe("calc(2ch + 1.25rem)")
    cleanup()

    const ten = render(
      <CodeViewer
        source={textSource(Array.from({ length: 10 }, () => "x").join("\n"))}
        controls={false}
      />
    )
    // 2 digits + 1 spare char + horizontal gutter padding.
    expect(gutterWidth(ten.container, 1)).toBe("calc(3ch + 1.25rem)")
  })

  it("uses a padded 2ch gutter for a single empty line", () => {
    const { container } = render(<CodeViewer source={textSource("")} />)
    expect(gutterWidth(container, 1)).toBe("calc(2ch + 1.25rem)")
  })

  it("keeps the fixed gutter rail on the same monospace metrics as row gutters", () => {
    const { container } = render(
      <CodeViewer
        source={textSource(Array.from({ length: 6001 }, () => "x").join("\n"))}
        controls={false}
      />
    )

    const rail = gutterRail(container)
    expect(rail?.style.width).toBe(gutterWidth(container, 1))
    expect(rail?.style.fontSize).toBe("12px")
    expect(rail?.className).toContain("font-mono")
  })
})

describe("highlight boundaries", () => {
  it("truncates fractional highlight bounds before clamping", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo\nthree\nfour")}
        highlight={{ start: 1.9, end: 2.9 }}
      />
    )

    expect(lineRow(container, 1)?.style.backgroundColor).toContain("color-mix")
    expect(lineRow(container, 2)?.style.backgroundColor).toContain("color-mix")
    expect(lineRow(container, 3)?.style.backgroundColor).toBe("")
  })

  it("highlights the final line when the range ends exactly at the line count", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: 3, end: 3 }}
      />
    )

    expect(lineRow(container, 3)?.style.backgroundColor).toContain("color-mix")
    expect(lineRow(container, 2)?.style.backgroundColor).toBe("")
  })

  it("clamps a range that overruns the document end", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo\nthree")}
        highlight={{ start: 2, end: 99 }}
      />
    )

    expect(lineRow(container, 1)?.style.backgroundColor).toBe("")
    expect(lineRow(container, 2)?.style.backgroundColor).toContain("color-mix")
    expect(lineRow(container, 3)?.style.backgroundColor).toContain("color-mix")
  })

  it("does not highlight a zero/negative range entirely before line 1", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("one\ntwo")}
        highlight={{ start: -3, end: 0 }}
      />
    )

    expect(container.querySelector(".bg-primary\\/12")).toBeNull()
  })

  it("highlights the only line of a single-line document", () => {
    const { container } = render(
      <CodeViewer
        source={textSource("solo")}
        highlight={{ start: 1, end: 1 }}
      />
    )

    expect(lineRow(container, 1)?.style.backgroundColor).toContain("color-mix")
  })
})

describe("bare chrome variant", () => {
  it("drops the border/rounded shell and fills its container when bare", () => {
    const { container } = render(
      <CodeViewer source={textSource("alpha")} bare />
    )

    const className = frameClassName(container)
    expect(className).toContain("h-full")
    expect(className).toContain("bg-muted/20")
    expect(className).not.toContain("rounded-xl")
    expect(className).not.toContain("border")
  })

  it("keeps the bordered shell by default", () => {
    const { container } = render(<CodeViewer source={textSource("alpha")} />)

    const className = frameClassName(container)
    expect(className).toContain("rounded-xl")
    expect(className).toContain("border")
    expect(className).toContain("bg-muted/30")
  })
})

describe("code viewer surface colors", () => {
  it("keeps the code canvas on background while the line gutter stays muted", () => {
    const { container } = render(<CodeViewer source={textSource("alpha")} />)

    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const gutter = container.querySelector<HTMLElement>(
      '[data-line-number="1"] span:first-child'
    )
    const code = container.querySelector<HTMLElement>(
      '[data-line-number="1"] span:last-child'
    )

    expect(viewport?.parentElement?.parentElement?.className).toContain(
      "bg-background"
    )
    expect(gutter?.className).toContain("sticky")
    expect(gutter?.className).toContain("left-0")
    expect(gutter?.className).toContain("border-r")
    expect(gutter?.style.backgroundColor).toContain("color-mix")
    expect(code?.className).not.toContain("bg-muted")
  })
})

describe("download naming defaults", () => {
  it("falls back to text.txt when inline text has no file name", async () => {
    mockObjectUrls("blob:default-name")
    const { clicks } = captureAnchorClicks()

    render(<CodeViewer source={textSource("no name here")} />)

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
      <CodeViewer
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
    render(<CodeViewer source={textSource("alpha")} />)

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
    const { container } = render(<CodeViewer source={textSource("alpha")} />)
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
        content: createViewerResource({
          kind: "url",
          url: "/too-many-bytes.bin",
        }).content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxBytes: 3 }),
      })
    ).rejects.toThrow("bytes limit")
  })
})

// The streamed line-limit tracker must agree with splitTextLines about what a
// line break is, otherwise a URL load could pass the streaming check yet count
// differently once rendered. Unicode separators count toward maxLines too.
describe("streamed line-limit counts Unicode separators", () => {
  it("rejects a separator-delimited URL body that exceeds maxLines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a" + LS + "b" + PS + "c")))
    )

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource({ kind: "url", url: "/sep-too-many.txt" })
          .content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 2 }),
      })
    ).rejects.toThrow("lines limit")
  })

  it("accepts the same body when the line budget covers every separator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a" + LS + "b" + PS + "c")))
    )

    await expect(
      readResourceAfterSuspense({
        content: createViewerResource({ kind: "url", url: "/sep-ok.txt" })
          .content,
        retryVersion: 0,
        bounds: resolvedTextViewerBounds({ maxLines: 3 }),
      })
    ).resolves.toBe("a" + LS + "b" + PS + "c")
  })
})
