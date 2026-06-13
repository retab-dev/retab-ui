import { afterEach, describe, expect, it, vi } from "vitest"

import { clearThumbnailCachesForTests } from "@/components/document-thumbnail/thumbnail-test-reset"
import {
  createThumbnailWorkerClient,
  type ThumbnailWorkerMessage,
} from "@/components/document-thumbnail/thumbnail-worker-client"

interface TestRequest extends ThumbnailWorkerMessage {
  payload: string
}

interface TestResponse extends ThumbnailWorkerMessage {
  ok: boolean
  value?: string
  error?: string
}

class MockWorker {
  onmessage: ((event: MessageEvent<TestResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: unknown[] = []
  transfers: Transferable[][] = []
  terminate = vi.fn()

  postMessage(message: unknown, transfer?: Transferable[]) {
    this.messages.push(message)
    this.transfers.push(transfer ?? [])
  }
}

function createClient() {
  const workers: MockWorker[] = []
  const client = createThumbnailWorkerClient<TestRequest, TestResponse>({
    createWorker: () => {
      const worker = new MockWorker()
      workers.push(worker)
      return worker as unknown as Worker
    },
    resolve: (response) =>
      response.ok && response.value !== undefined ? response.value : undefined,
    reject: (response) => response.error ?? "worker failed",
  })
  return { client, workers }
}

afterEach(() => {
  clearThumbnailCachesForTests()
  vi.restoreAllMocks()
})

describe("createThumbnailWorkerClient", () => {
  it("resolves requests and clears pending entries", async () => {
    const { client, workers } = createClient()

    const promise = client.request<string>({
      request: { payload: "parse" },
    })

    expect(client.pendingCount()).toBe(1)
    expect(workers[0]!.messages[0]).toEqual({ id: 1, payload: "parse" })

    workers[0]!.onmessage?.({
      data: { id: 1, ok: true, value: "done" },
    } as MessageEvent<TestResponse>)

    await expect(promise).resolves.toBe("done")
    expect(client.pendingCount()).toBe(0)
  })

  it("rejects failed worker responses and clears pending entries", async () => {
    const { client, workers } = createClient()

    const promise = client.request<string>({
      request: { payload: "parse" },
    })
    workers[0]!.onmessage?.({
      data: { id: 1, ok: false, error: "bad file" },
    } as MessageEvent<TestResponse>)

    await expect(promise).rejects.toThrow("bad file")
    expect(client.pendingCount()).toBe(0)
  })

  it("rejects every pending request on worker error", async () => {
    const { client, workers } = createClient()

    const first = client.request<string>({ request: { payload: "first" } })
    const second = client.request<string>({ request: { payload: "second" } })

    workers[0]!.onerror?.({
      message: "crashed",
    } as ErrorEvent)

    await expect(first).rejects.toThrow("crashed")
    await expect(second).rejects.toThrow("crashed")
    expect(client.pendingCount()).toBe(0)
  })

  it("resets the worker and rejects pending requests", async () => {
    const { client, workers } = createClient()

    const promise = client.request<string>({
      request: { payload: "parse" },
    })
    client.reset()

    await expect(promise).rejects.toThrow("Thumbnail worker reset")
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1)
    expect(client.pendingCount()).toBe(0)
  })

  it("ignores late worker responses after reset", async () => {
    const { client, workers } = createClient()

    const promise = client.request<string>({
      request: { payload: "parse" },
    })
    client.reset()

    await expect(promise).rejects.toThrow("Thumbnail worker reset")
    workers[0]!.onmessage?.({
      data: { id: 1, ok: true, value: "late" },
    } as MessageEvent<TestResponse>)

    expect(client.pendingCount()).toBe(0)
  })

  it("rejects responses whose success payload cannot be resolved", async () => {
    const { client, workers } = createClient()

    const promise = client.request<string>({
      request: { payload: "parse" },
    })
    workers[0]!.onmessage?.({
      data: { id: 1, ok: true },
    } as MessageEvent<TestResponse>)

    await expect(promise).rejects.toThrow("worker failed")
    expect(client.pendingCount()).toBe(0)
  })

  it("passes transferables through to the worker", () => {
    const { client, workers } = createClient()
    const buffer = new ArrayBuffer(4)

    const promise = client.request<string>({
      request: { payload: "parse" },
      transfer: [buffer],
    })
    workers[0]!.onmessage?.({
      data: { id: 1, ok: true, value: "done" },
    } as MessageEvent<TestResponse>)

    expect(workers[0]!.transfers[0]).toEqual([buffer])
    return expect(promise).resolves.toBe("done")
  })
})
