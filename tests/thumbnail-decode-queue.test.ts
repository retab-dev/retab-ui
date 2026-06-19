import { afterEach, describe, expect, it } from "vitest";

import {
  getThumbnailDecodeQueueSnapshot,
  withThumbnailDecodeSlot,
} from "@/components/file-thumbnail/thumbnail-decode-queue";
import { clearThumbnailCachesForTests } from "@/components/file-thumbnail/thumbnail-test-reset";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  clearThumbnailCachesForTests();
});

describe("thumbnail decode queue", () => {
  it("runs no more than the configured number of heavy decodes at once", async () => {
    const gates = Array.from({ length: 5 }, () => deferred());
    let active = 0;
    let maxActive = 0;

    const tasks = gates.map((gate, index) =>
      withThumbnailDecodeSlot(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate.promise;
        active -= 1;
        return index;
      }),
    );

    await nextTick();
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 3,
      queuedDecodes: 2,
      maxConcurrentDecodes: 3,
    });
    expect(maxActive).toBe(3);

    gates[0]!.resolve();
    await tasks[0];
    await nextTick();

    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 3,
      queuedDecodes: 1,
    });
    expect(maxActive).toBe(3);

    for (const gate of gates.slice(1)) gate.resolve();
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4]);
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 0,
      queuedDecodes: 0,
    });
  });

  it("releases a decode slot when heavy work rejects", async () => {
    const failure = new Error("decode failed");

    await expect(
      withThumbnailDecodeSlot(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 0,
      queuedDecodes: 0,
    });
  });

  it("ignores stale releases from work that was active before a test reset", async () => {
    const gate = deferred();
    const task = withThumbnailDecodeSlot(async () => {
      await gate.promise;
      return "done";
    });

    await nextTick();
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 1,
      queuedDecodes: 0,
    });

    clearThumbnailCachesForTests();
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 0,
      queuedDecodes: 0,
    });

    gate.resolve();
    await expect(task).resolves.toBe("done");
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 0,
      queuedDecodes: 0,
    });
  });

  it("does not start queued work from before a test reset", async () => {
    const gates = Array.from({ length: 3 }, () => deferred());
    let staleQueuedStarted = false;

    const activeTasks = gates.map((gate) =>
      withThumbnailDecodeSlot(async () => {
        await gate.promise;
      }),
    );
    void withThumbnailDecodeSlot(async () => {
      staleQueuedStarted = true;
    });

    await nextTick();
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 3,
      queuedDecodes: 1,
    });

    clearThumbnailCachesForTests();
    for (const gate of gates) gate.resolve();
    await Promise.all(activeTasks);
    await nextTick();

    expect(staleQueuedStarted).toBe(false);
    expect(getThumbnailDecodeQueueSnapshot()).toMatchObject({
      activeDecodes: 0,
      queuedDecodes: 0,
    });
  });
});
