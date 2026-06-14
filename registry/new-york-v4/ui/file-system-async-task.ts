"use client"

export type FileSystemAsyncTaskId = string

export type FileSystemAsyncTaskKey = string

export type FileSystemAsyncTask<TInput> = {
  abortController: AbortController
  id: FileSystemAsyncTaskId
  input: TInput
  key: FileSystemAsyncTaskKey
}

export type FileSystemAsyncTaskWaiter<TResult> = {
  reject: (error: unknown) => void
  resolve: (result: TResult) => void
}

export type FileSystemAsyncTaskStart<TInput, TResult> = {
  promise: Promise<TResult>
  started: boolean
  task: FileSystemAsyncTask<TInput>
}

export type FileSystemAsyncTaskRuntime<TInput, TResult> = {
  abort: (key: FileSystemAsyncTaskKey, reason: string) => void
  abortAll: (reason: string) => void
  fail: (task: FileSystemAsyncTask<TInput>, error: unknown) => boolean
  get: (key: FileSystemAsyncTaskKey) => FileSystemAsyncTask<TInput> | null
  join: (task: FileSystemAsyncTask<TInput>) => Promise<TResult>
  start: (input: TInput) => FileSystemAsyncTaskStart<TInput, TResult>
  succeed: (task: FileSystemAsyncTask<TInput>, result: TResult) => boolean
}

export function createFileSystemAsyncTaskRuntime<TInput, TResult>({
  createTaskId = createDefaultTaskId,
  keyForInput,
}: {
  createTaskId?: () => FileSystemAsyncTaskId
  keyForInput: (input: TInput) => FileSystemAsyncTaskKey
}): FileSystemAsyncTaskRuntime<TInput, TResult> {
  const tasksByKey = new Map<
    FileSystemAsyncTaskKey,
    FileSystemAsyncTask<TInput>
  >()
  const waitersByTaskId = new Map<
    FileSystemAsyncTaskId,
    FileSystemAsyncTaskWaiter<TResult>[]
  >()

  function join(task: FileSystemAsyncTask<TInput>) {
    const promise = new Promise<TResult>((resolve, reject) => {
      const currentTask = tasksByKey.get(task.key)

      if (currentTask?.id !== task.id) {
        reject(createStaleTaskError(task))
        return
      }

      const waiters = waitersByTaskId.get(task.id) ?? []
      waiters.push({ reject, resolve })
      waitersByTaskId.set(task.id, waiters)
    })

    void promise.catch(() => {})
    return promise
  }

  function start(input: TInput): FileSystemAsyncTaskStart<TInput, TResult> {
    const key = keyForInput(input)
    const currentTask = tasksByKey.get(key)

    if (currentTask) {
      return {
        promise: join(currentTask),
        started: false,
        task: currentTask,
      }
    }

    const task = {
      abortController: new AbortController(),
      id: createTaskId(),
      input,
      key,
    }

    tasksByKey.set(key, task)

    return {
      promise: join(task),
      started: true,
      task,
    }
  }

  function succeed(task: FileSystemAsyncTask<TInput>, result: TResult) {
    return settle(task, (waiter) => waiter.resolve(result))
  }

  function fail(task: FileSystemAsyncTask<TInput>, error: unknown) {
    return settle(task, (waiter) => waiter.reject(error))
  }

  function abort(key: FileSystemAsyncTaskKey, reason: string) {
    const task = tasksByKey.get(key)

    if (!task) return

    task.abortController.abort()
    fail(task, createAbortTaskError(task, reason))
  }

  function abortAll(reason: string) {
    for (const key of [...tasksByKey.keys()]) {
      abort(key, reason)
    }
  }

  function settle(
    task: FileSystemAsyncTask<TInput>,
    settleWaiter: (waiter: FileSystemAsyncTaskWaiter<TResult>) => void
  ) {
    const currentTask = tasksByKey.get(task.key)

    if (currentTask?.id !== task.id) return false

    const waiters = waitersByTaskId.get(task.id) ?? []
    tasksByKey.delete(task.key)
    waitersByTaskId.delete(task.id)

    for (const waiter of waiters) settleWaiter(waiter)

    return true
  }

  function get(key: FileSystemAsyncTaskKey) {
    return tasksByKey.get(key) ?? null
  }

  return { abort, abortAll, fail, get, join, start, succeed }
}

function createDefaultTaskId() {
  return `task:${Math.random().toString(36).slice(2)}`
}

function createStaleTaskError<TInput>(task: FileSystemAsyncTask<TInput>) {
  return new Error(`Stale async task: ${task.id}`)
}

function createAbortTaskError<TInput>(
  task: FileSystemAsyncTask<TInput>,
  reason: string
) {
  return new Error(`Aborted async task ${task.id}: ${reason}`)
}
