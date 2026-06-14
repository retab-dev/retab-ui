import { describe, expect, it } from "vitest"

import { createFileSystemAsyncTaskRuntime } from "@/registry/new-york-v4/ui/file-system-async-task"

describe("FileSystemAsyncTask", () => {
  it("dedupes by task key and settles every waiter once", async () => {
    let nextTaskNumber = 0
    const runtime = createFileSystemAsyncTaskRuntime<
      { key: string },
      string
    >({
      createTaskId: () => `task:${++nextTaskNumber}`,
      keyForInput: (input) => input.key,
    })

    const first = runtime.start({ key: "a" })
    const second = runtime.start({ key: "a" })

    expect(first.started).toBe(true)
    expect(second.started).toBe(false)
    expect(second.task.id).toBe(first.task.id)

    runtime.succeed(first.task, "done")

    await expect(first.promise).resolves.toBe("done")
    await expect(second.promise).resolves.toBe("done")
  })

  it("rejects stale joins and ignores stale settlement", async () => {
    let nextTaskNumber = 0
    const runtime = createFileSystemAsyncTaskRuntime<
      { key: string },
      string
    >({
      createTaskId: () => `task:${++nextTaskNumber}`,
      keyForInput: (input) => input.key,
    })
    const first = runtime.start({ key: "a" })

    runtime.abort("a", "superseded")

    const second = runtime.start({ key: "a" })

    expect(runtime.succeed(first.task, "stale")).toBe(false)
    runtime.succeed(second.task, "current")

    await expect(first.promise).rejects.toThrow("superseded")
    await expect(second.promise).resolves.toBe("current")
  })

  it("aborts every active task deterministically", async () => {
    let nextTaskNumber = 0
    const runtime = createFileSystemAsyncTaskRuntime<
      { key: string },
      string
    >({
      createTaskId: () => `task:${++nextTaskNumber}`,
      keyForInput: (input) => input.key,
    })
    const first = runtime.start({ key: "a" })
    const second = runtime.start({ key: "b" })

    runtime.abortAll("unmount")

    await expect(first.promise).rejects.toThrow("unmount")
    await expect(second.promise).rejects.toThrow("unmount")
  })
})
