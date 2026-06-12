// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  createHrefDownloadAction,
  ViewerDownloadError,
  type ViewerDownloadAction,
  type ViewerDownloadPayload,
} from "@/registry/new-york-v4/lib/viewer-download"
import {
  triggerViewerDownload,
  useViewerDownloadTrigger,
  ViewerDownloadControl,
  type ViewerDownloadErrorHandler,
} from "@/registry/new-york-v4/ui/viewer-download"

function mockObjectUrls(url = "blob:viewer-download") {
  const createObjectURL = vi.fn(() => url)
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

function originalDownloadAction(): ViewerDownloadAction {
  return createHrefDownloadAction({
    id: "download-original",
    label: "Download original",
    href: "/files/report.csv",
    fileName: "report.csv",
  })
}

function menuItem(label: string): HTMLElement {
  const item = screen.getByText(label).closest('[role="menuitem"]')
  if (!item) throw new Error(`Menu item not found: ${label}`)
  return item as HTMLElement
}

async function openDownloadMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Download" }))
  await screen.findByText("Download original")
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function derivedAction({
  id,
  label = "Export table",
  getPayload,
  isDisabled,
}: {
  id: string
  label?: string
  getPayload: ViewerDownloadAction["getPayload"]
  isDisabled?: boolean
}): ViewerDownloadAction {
  return {
    id,
    label,
    fileName: `${id}.txt`,
    origin: "derived",
    isDisabled,
    getPayload,
  }
}

function DownloadTriggerHarness({
  actions,
  onError,
  resetKey,
}: {
  actions: ViewerDownloadAction[]
  onError?: ViewerDownloadErrorHandler
  resetKey?: unknown
}) {
  const { pendingActionId, triggerDownload } = useViewerDownloadTrigger({
    onError,
    resetKey,
  })

  return (
    <div
      data-testid="download-trigger-state"
      data-pending-action-id={pendingActionId ?? ""}
    >
      {actions.map((action) => (
        <button key={action.id} onClick={() => triggerDownload(action)}>
          {action.label}
        </button>
      ))}
    </div>
  )
}

function downloadTriggerState() {
  return screen.getByTestId("download-trigger-state")
}

beforeEach(() => {
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("triggerViewerDownload", () => {
  it("downloads href payloads without creating object URLs", async () => {
    const { clicks } = captureAnchorClicks()

    await triggerViewerDownload(
      createHrefDownloadAction({
        id: "download-original",
        href: "/files/report.pdf",
        fileName: "report.pdf",
      })
    )

    expect(clicks).toEqual([
      { href: "/files/report.pdf", download: "report.pdf" },
    ])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("downloads text payloads through a revoked object URL", async () => {
    const { clicks } = captureAnchorClicks()

    await triggerViewerDownload({
      id: "csv-export-table",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => ({
        kind: "text",
        text: "a,b\n1,2",
        mimeType: "text/csv;charset=utf-8",
      }),
    })

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(clicks).toEqual([
      { href: "blob:viewer-download", download: "data.csv" },
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-download")
  })

  it("downloads blob payloads through a revoked object URL", async () => {
    const { clicks } = captureAnchorClicks()
    const blob = new Blob(["pdf"], { type: "application/pdf" })

    await triggerViewerDownload({
      id: "pdf-export",
      label: "Export PDF",
      fileName: "report.pdf",
      origin: "derived",
      getPayload: () => ({ kind: "blob", blob }),
    })

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicks).toEqual([
      { href: "blob:viewer-download", download: "report.pdf" },
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-download")
  })

  it("treats none payloads as successful no-ops", async () => {
    const { click } = captureAnchorClicks()

    await triggerViewerDownload({
      id: "no-download",
      label: "No download",
      fileName: "none.txt",
      origin: "derived",
      getPayload: () => ({ kind: "none" }),
    })

    expect(click).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("models disabled actions as typed download errors", async () => {
    await expect(
      triggerViewerDownload({
        id: "disabled",
        label: "Download",
        fileName: "disabled.txt",
        origin: "original",
        isDisabled: true,
        getPayload: () => ({ kind: "none" }),
      })
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "disabled",
      actionId: "disabled",
    } satisfies Partial<ViewerDownloadError>)
  })

  it("passes abort signals to payload creation and models aborts as typed download errors", async () => {
    const abortController = new AbortController()
    const getPayload = vi.fn<ViewerDownloadAction["getPayload"]>(
      ({ signal } = {}) => {
        expect(signal).toBe(abortController.signal)
        throw new DOMException("cancelled", "AbortError")
      }
    )

    await expect(
      triggerViewerDownload(
        {
          id: "abort-export",
          label: "Export table",
          fileName: "abort.csv",
          origin: "derived",
          getPayload,
        },
        { signal: abortController.signal }
      )
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "aborted",
      actionId: "abort-export",
    } satisfies Partial<ViewerDownloadError>)
    expect(getPayload).toHaveBeenCalledTimes(1)
  })

  it("models payload preparation failures as typed download errors", async () => {
    const cause = new Error("bad export")

    await expect(
      triggerViewerDownload({
        id: "broken-export",
        label: "Export table",
        fileName: "broken.csv",
        origin: "derived",
        getPayload: () => Promise.reject(cause),
      })
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "payload_failed",
      actionId: "broken-export",
      cause,
    } satisfies Partial<ViewerDownloadError>)
  })

  it("models browser download startup failures as typed download errors", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked")
    })

    await expect(
      triggerViewerDownload(
        createHrefDownloadAction({
          id: "blocked-download",
          href: "/files/report.pdf",
          fileName: "report.pdf",
        })
      )
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "unsupported",
      actionId: "blocked-download",
    } satisfies Partial<ViewerDownloadError>)
  })

  it("models object URL failures as typed download errors", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("blocked")
      }),
    })

    await expect(
      triggerViewerDownload({
        id: "blocked-export",
        label: "Export table",
        fileName: "data.csv",
        origin: "derived",
        getPayload: () => ({
          kind: "text",
          text: "a,b\n1,2",
          mimeType: "text/csv;charset=utf-8",
        }),
      })
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "unsupported",
      actionId: "blocked-export",
    } satisfies Partial<ViewerDownloadError>)
  })
})

describe("useViewerDownloadTrigger", () => {
  it("exposes the active action id and clears it after success", async () => {
    const payload = createDeferred<ViewerDownloadPayload>()
    const action = derivedAction({
      id: "slow-export",
      getPayload: () => payload.promise,
    })

    render(<DownloadTriggerHarness actions={[action]} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() =>
      expect(downloadTriggerState().dataset.pendingActionId).toBe("slow-export")
    )

    await act(async () => {
      payload.resolve({ kind: "none" })
      await payload.promise
    })

    await waitFor(() =>
      expect(downloadTriggerState().dataset.pendingActionId).toBe("")
    )
  })

  it("reports payload preparation failures with the original action", async () => {
    const onError = vi.fn()
    const cause = new Error("bad export")
    const action = derivedAction({
      id: "broken-export",
      getPayload: () => Promise.reject(cause),
    })

    render(<DownloadTriggerHarness actions={[action]} onError={onError} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "payload_failed",
          actionId: "broken-export",
          cause,
        }),
        action
      )
    )
  })

  it("reports browser startup failures with the original action", async () => {
    const onError = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("blocked")
      }),
    })
    const action = derivedAction({
      id: "blocked-export",
      getPayload: () => ({ kind: "text", text: "a,b\n1,2" }),
    })

    render(<DownloadTriggerHarness actions={[action]} onError={onError} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "unsupported",
          actionId: "blocked-export",
        }),
        action
      )
    )
  })

  it("reports disabled actions when the hook is invoked directly", async () => {
    const onError = vi.fn()
    const action = derivedAction({
      id: "disabled-export",
      isDisabled: true,
      getPayload: () => ({ kind: "none" }),
    })

    render(<DownloadTriggerHarness actions={[action]} onError={onError} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "disabled",
          actionId: "disabled-export",
        }),
        action
      )
    )
  })

  it("suppresses aborted download errors", async () => {
    const onError = vi.fn()
    const aborts: AbortSignal[] = []
    const action = derivedAction({
      id: "slow-export",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          aborts.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    })

    const view = render(
      <DownloadTriggerHarness actions={[action]} onError={onError} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))
    await waitFor(() => expect(aborts).toHaveLength(1))

    view.unmount()

    await waitFor(() => expect(aborts[0].aborted).toBe(true))
    await act(async () => {})
    expect(onError).not.toHaveBeenCalled()
  })

  it("aborts the previous action when a new action starts", async () => {
    const onError = vi.fn()
    const firstSignals: AbortSignal[] = []
    const secondSignals: AbortSignal[] = []
    const firstAction = derivedAction({
      id: "first-export",
      label: "First export",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          firstSignals.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    })
    const secondAction = derivedAction({
      id: "second-export",
      label: "Second export",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          secondSignals.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    })

    render(
      <DownloadTriggerHarness
        actions={[firstAction, secondAction]}
        onError={onError}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "First export" }))
    await waitFor(() => expect(firstSignals).toHaveLength(1))
    fireEvent.click(screen.getByRole("button", { name: "Second export" }))

    await waitFor(() => {
      expect(firstSignals[0].aborted).toBe(true)
      expect(secondSignals).toHaveLength(1)
      expect(downloadTriggerState().dataset.pendingActionId).toBe(
        "second-export"
      )
    })
    expect(onError).not.toHaveBeenCalled()
  })

  it("aborts the active action on reset key changes", async () => {
    const onError = vi.fn()
    const aborts: AbortSignal[] = []
    const action = derivedAction({
      id: "slow-export",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          aborts.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    })

    const view = render(
      <DownloadTriggerHarness
        actions={[action]}
        onError={onError}
        resetKey="first"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))
    await waitFor(() => expect(aborts).toHaveLength(1))

    view.rerender(
      <DownloadTriggerHarness
        actions={[action]}
        onError={onError}
        resetKey="second"
      />
    )

    await waitFor(() => expect(aborts[0].aborted).toBe(true))
    await act(async () => {})
    expect(onError).not.toHaveBeenCalled()
  })

  it("does not let an older aborted action clear newer pending state", async () => {
    const firstPayload = createDeferred<ViewerDownloadPayload>()
    const secondPayload = createDeferred<ViewerDownloadPayload>()
    const firstSignals: AbortSignal[] = []
    const firstAction = derivedAction({
      id: "first-export",
      label: "First export",
      getPayload: ({ signal } = {}) => {
        if (signal) firstSignals.push(signal)
        return firstPayload.promise
      },
    })
    const secondAction = derivedAction({
      id: "second-export",
      label: "Second export",
      getPayload: () => secondPayload.promise,
    })

    render(<DownloadTriggerHarness actions={[firstAction, secondAction]} />)

    fireEvent.click(screen.getByRole("button", { name: "First export" }))
    await waitFor(() =>
      expect(downloadTriggerState().dataset.pendingActionId).toBe(
        "first-export"
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Second export" }))
    await waitFor(() => {
      expect(firstSignals[0].aborted).toBe(true)
      expect(downloadTriggerState().dataset.pendingActionId).toBe(
        "second-export"
      )
    })

    await act(async () => {
      firstPayload.reject(new DOMException("cancelled", "AbortError"))
      try {
        await firstPayload.promise
      } catch {
        // Expected: the hook suppresses aborted download errors.
      }
    })

    expect(downloadTriggerState().dataset.pendingActionId).toBe("second-export")

    await act(async () => {
      secondPayload.resolve({ kind: "none" })
      await secondPayload.promise
    })

    await waitFor(() =>
      expect(downloadTriggerState().dataset.pendingActionId).toBe("")
    )
  })
})

describe("ViewerDownloadControl", () => {
  it("renders synchronous href actions as links", () => {
    render(
      <ViewerDownloadControl
        actions={[
          createHrefDownloadAction({
            id: "download-original",
            href: "/files/report.pdf",
            fileName: "report.pdf",
          }),
        ]}
      />
    )

    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/files/report.pdf")
    expect(link.getAttribute("download")).toBe("report.pdf")
  })

  it("defers derived payload creation until click", async () => {
    const getPayload = vi.fn(() => ({
      kind: "text" as const,
      text: "a,b\n1,2",
      mimeType: "text/csv;charset=utf-8",
    }))
    const { clicks } = captureAnchorClicks()

    render(
      <ViewerDownloadControl
        actions={[
          {
            id: "csv-export-table",
            label: "Export table",
            fileName: "data.csv",
            origin: "derived",
            getPayload,
          },
        ]}
      />
    )

    expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy()
    expect(getPayload).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() => expect(getPayload).toHaveBeenCalledTimes(1))
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(clicks).toEqual([
      { href: "blob:viewer-download", download: "data.csv" },
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-download")
  })

  it("contains failed generated downloads inside the control", async () => {
    const onError = vi.fn()
    const action: ViewerDownloadAction = {
      id: "broken-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => Promise.reject(new Error("bad export")),
    }

    render(<ViewerDownloadControl actions={[action]} onError={onError} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy()
    })
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ViewerDownloadError",
        kind: "payload_failed",
        actionId: "broken-export",
      }),
      action
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("reports browser download start failures through onError", async () => {
    const onError = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("blocked")
      }),
    })
    const action: ViewerDownloadAction = {
      id: "blocked-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => ({
        kind: "text",
        text: "a,b\n1,2",
        mimeType: "text/csv;charset=utf-8",
      }),
    }

    render(<ViewerDownloadControl actions={[action]} onError={onError} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "unsupported",
          actionId: "blocked-export",
        }),
        action
      )
    )
  })

  it("aborts pending generated downloads when the control unmounts", async () => {
    const onError = vi.fn()
    const aborts: AbortSignal[] = []
    const action: ViewerDownloadAction = {
      id: "slow-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          aborts.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    }

    const view = render(
      <ViewerDownloadControl actions={[action]} onError={onError} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))
    await waitFor(() => expect(aborts).toHaveLength(1))

    view.unmount()

    await waitFor(() => expect(aborts[0].aborted).toBe(true))
    expect(onError).not.toHaveBeenCalled()
  })

  it("reports failed multi-action menu downloads through onError", async () => {
    const onError = vi.fn()
    const brokenExportAction: ViewerDownloadAction = {
      id: "broken-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => Promise.reject(new Error("bad export")),
    }

    render(
      <ViewerDownloadControl
        actions={[originalDownloadAction(), brokenExportAction]}
        onError={onError}
      />
    )

    await openDownloadMenu()
    fireEvent.click(menuItem("Export table"))

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ViewerDownloadError",
          kind: "payload_failed",
          actionId: "broken-export",
        }),
        brokenExportAction
      )
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("reports button and menu download failures through the same non-preview error contract", async () => {
    const buttonError = vi.fn()
    const menuError = vi.fn()
    const buttonAction: ViewerDownloadAction = {
      id: "button-broken-export",
      label: "Export table",
      fileName: "button.csv",
      origin: "derived",
      getPayload: () => Promise.reject(new Error("button export failed")),
    }
    const menuAction: ViewerDownloadAction = {
      id: "menu-broken-export",
      label: "Export table",
      fileName: "menu.csv",
      origin: "derived",
      getPayload: () => Promise.reject(new Error("menu export failed")),
    }

    render(
      <div>
        <ViewerDownloadControl actions={[buttonAction]} onError={buttonError} />
        <ViewerDownloadControl
          actions={[originalDownloadAction(), menuAction]}
          onError={menuError}
        />
      </div>
    )

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))
    await openDownloadMenu()
    fireEvent.click(menuItem("Export table"))

    await waitFor(() => {
      expect(buttonError).toHaveBeenCalledTimes(1)
      expect(menuError).toHaveBeenCalledTimes(1)
    })

    const [buttonDownloadError, reportedButtonAction] =
      buttonError.mock.calls[0] ?? []
    const [menuDownloadError, reportedMenuAction] =
      menuError.mock.calls[0] ?? []

    expect(reportedButtonAction).toBe(buttonAction)
    expect(reportedMenuAction).toBe(menuAction)
    expect(buttonDownloadError).toMatchObject({
      name: "ViewerDownloadError",
      kind: "payload_failed",
      actionId: buttonAction.id,
    } satisfies Partial<ViewerDownloadError>)
    expect(menuDownloadError).toMatchObject({
      name: "ViewerDownloadError",
      kind: "payload_failed",
      actionId: menuAction.id,
    } satisfies Partial<ViewerDownloadError>)
    expect(buttonDownloadError.cause).toBeInstanceOf(Error)
    expect(menuDownloadError.cause).toBeInstanceOf(Error)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("disables multi-action menu items while a download is pending", async () => {
    const getPayload = vi.fn<() => Promise<ViewerDownloadPayload>>(
      () => new Promise(() => {})
    )
    const slowExportAction: ViewerDownloadAction = {
      id: "slow-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload,
    }

    render(
      <ViewerDownloadControl
        actions={[originalDownloadAction(), slowExportAction]}
      />
    )

    await openDownloadMenu()
    fireEvent.click(menuItem("Export table"))

    await waitFor(() => {
      const trigger = screen.getByRole("button", { name: "Download" })
      expect(trigger.hasAttribute("data-loading")).toBe(true)
      expect(trigger.hasAttribute("disabled")).toBe(true)
    })

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    expect(getPayload).toHaveBeenCalledTimes(1)
  })

  it("aborts pending multi-action downloads when the action set changes", async () => {
    const onError = vi.fn()
    const aborts: AbortSignal[] = []
    const slowExportAction: ViewerDownloadAction = {
      id: "slow-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: ({ signal } = {}) =>
        new Promise((_, reject) => {
          if (!signal) return
          aborts.push(signal)
          signal.addEventListener("abort", () => {
            reject(new DOMException("cancelled", "AbortError"))
          })
        }),
    }

    const view = render(
      <ViewerDownloadControl
        actions={[originalDownloadAction(), slowExportAction]}
        onError={onError}
      />
    )

    await openDownloadMenu()
    fireEvent.click(menuItem("Export table"))
    await waitFor(() => expect(aborts).toHaveLength(1))

    view.rerender(
      <ViewerDownloadControl
        actions={[
          originalDownloadAction(),
          {
            ...slowExportAction,
            id: "replacement-export",
          },
        ]}
        onError={onError}
      />
    )

    await waitFor(() => expect(aborts[0].aborted).toBe(true))
    expect(onError).not.toHaveBeenCalled()
  })

  it("does not trigger disabled multi-action menu items", async () => {
    const onError = vi.fn()
    const disabledExportAction: ViewerDownloadAction = {
      id: "disabled-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      isDisabled: true,
      getPayload: vi.fn(() => ({ kind: "none" as const })),
    }

    render(
      <ViewerDownloadControl
        actions={[originalDownloadAction(), disabledExportAction]}
        onError={onError}
      />
    )

    await openDownloadMenu()

    expect(menuItem("Export table").getAttribute("aria-disabled")).toBe("true")
    fireEvent.click(menuItem("Export table"))

    expect(disabledExportAction.getPayload).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
