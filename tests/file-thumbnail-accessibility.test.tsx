// @vitest-environment jsdom

import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { FileThumbnail } from "@/registry/new-york-v4/ui/file-thumbnail"

afterEach(() => {
  cleanup()
})

describe("FileThumbnail accessibility presentation", () => {
  it("hides preview internals when rendered decoratively", () => {
    const { container } = render(
      <FileThumbnail
        file={{ name: "sales.csv", type: "text/csv" }}
        presentation="decorative"
        previewContent={
          <table>
            <tbody>
              <tr>
                <td>Leaky cell</td>
              </tr>
            </tbody>
          </table>
        }
      />
    )

    const thumbnail = container.querySelector('[data-slot="file-thumbnail"]')
    expect(thumbnail?.getAttribute("aria-hidden")).toBe("true")
    expect(thumbnail?.getAttribute("role")).toBe("presentation")
  })
})
