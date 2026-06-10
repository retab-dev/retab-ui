// Integration tests for the playground run handlers, focused on verifying
// that uploads flow through uploadRetabFile + inputStateToUrlBackedMIMEData
// and that outgoing request bodies reference the uploaded URL (not raw bytes).
//
// We deliberately spy on:
//   - the fetchWithAuth namespace export
//   - the uploadRetabFile / uploadRetabFileAsMIMEData namespace exports
//   - the inputStateToUrlBackedMIMEData helper
// using spyOn on namespace imports (NOT mock.module) so restoration works
// between sibling test files — see memory/reference_bun_mock_module_leak.md.

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";

import * as authUtils from "@/backend/client-auth-utils";
import * as filesModule from "@/app/dashboard/shared/files/queries/files";
import * as uploadInputStateModule from "./upload-input-state";

import type { InputState } from "./execute-playground";
import { loadFileIntoInputState } from "./execute-playground";

// Lazy-imported in test bodies so module initialisation of large playgrounds
// (which pulls in lucide, shadcn, etc.) only happens once per test file.
import { createClassifierRunHandler } from "./classifier-playground";
import { createParseRunHandler } from "./parse-playground";
import { createSplitRunHandler } from "./split-playground";
import { createPartitionRunHandler } from "./partition-playground";
import { createAgentEditRunHandler } from "./agent-edit-playground";
import {
  createExtractRunHandler,
  type ExtractOutputState,
} from "./extract-playground";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "https://storage.retab.com/";
const BACKEND_BASE = "https://api.retab.test";

type CapturedCall = {
  url: string;
  init: RequestInit;
};

function jsonBody(
  calls: CapturedCall[],
  index: number,
): Record<string, unknown> {
  const call = calls[index];
  if (!call) throw new Error(`No captured call at index ${index}`);
  const body = call.init.body;
  if (typeof body !== "string") throw new Error("Body was not a string");
  return JSON.parse(body);
}

function makeFileInputState(overrides: Partial<InputState> = {}): InputState {
  const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
  return {
    id: "document",
    type: "file",
    fileBuffer: buffer,
    fileName: "invoice.pdf",
    fileMimeType: "application/pdf",
    uploadedFile: null,
    textValue: "",
    ...overrides,
  } as InputState;
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Global spy harness
// ---------------------------------------------------------------------------

const fetchCalls: CapturedCall[] = [];
let fetchResponder: (
  url: string,
  init?: RequestInit,
) => Promise<Response> = async () => okJson({});

let fetchSpy: ReturnType<typeof spyOn> | null = null;
let uploadFileSpy: ReturnType<typeof spyOn> | null = null;
let uploadMimeSpy: ReturnType<typeof spyOn> | null = null;
let urlBackedMimeSpy: ReturnType<typeof spyOn> | null = null;

beforeEach(() => {
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL = BACKEND_BASE;
  fetchCalls.length = 0;
  fetchResponder = async () => okJson({});

  fetchSpy = spyOn(authUtils, "fetchWithAuth").mockImplementation((async (
    url: string,
    init?: RequestInit,
  ) => {
    fetchCalls.push({ url, init: init ?? {} });
    return fetchResponder(url, init);
  }) as unknown as typeof authUtils.fetchWithAuth);

  // Default uploadRetabFile: return a stable uploaded record per File.
  uploadFileSpy = spyOn(filesModule, "uploadRetabFile").mockImplementation(
    async (file: File) => ({
      fileId: `file_${file.name}`,
      filename: file.name,
      url: `${STORAGE_PREFIX}file_${file.name}`,
      mimeType: file.type || "application/octet-stream",
    }),
  );

  uploadMimeSpy = spyOn(
    filesModule,
    "uploadRetabFileAsMIMEData",
  ).mockImplementation(async (file: File) => ({
    filename: file.name,
    url: `${STORAGE_PREFIX}file_${file.name}`,
  }));

  // We don't mock inputStateToUrlBackedMIMEData by default — we want to
  // observe it passing through. Install the spy so tests can assert call
  // counts without replacing the implementation.
  urlBackedMimeSpy = spyOn(
    uploadInputStateModule,
    "inputStateToUrlBackedMIMEData",
  );
});

afterEach(() => {
  fetchSpy?.mockRestore();
  uploadFileSpy?.mockRestore();
  uploadMimeSpy?.mockRestore();
  urlBackedMimeSpy?.mockRestore();
  uploadInputStateModule.clearInputStateUploadCacheForTests();
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
});

function assertUrlBackedBody(body: Record<string, unknown>) {
  const document = body.document as { filename: string; url: string };
  expect(document).toBeDefined();
  expect(typeof document.url).toBe("string");
  expect(document.url.startsWith(STORAGE_PREFIX)).toBe(true);
  // Should NOT contain inline bytes or base64 data URLs.
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("base64,");
  expect(serialized).not.toContain('"content"');
  expect(document).not.toHaveProperty("content");
}

// ---------------------------------------------------------------------------
// Classifier playground
// ---------------------------------------------------------------------------

describe("classifier run handler — URL-backed upload", () => {
  test("happy path: posts url-backed document to /v1/classifications", async () => {
    fetchResponder = async () => okJson({ output: { category: "Invoice" } });

    const handler = createClassifierRunHandler();
    const inputState = makeFileInputState();

    await handler([inputState], { categories: [{ name: "Invoice" }] });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe(`${BACKEND_BASE}/v1/classifications`);
    const body = jsonBody(fetchCalls, 0);
    assertUrlBackedBody(body);

    // The helper must have been invoked exactly once.
    expect(urlBackedMimeSpy).toHaveBeenCalledTimes(1);
    // And because uploadedFile was null, it must have gone through
    // uploadRetabFileAsMIMEData once.
    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);
  });

  test("re-run with already-uploaded file skips the upload call", async () => {
    fetchResponder = async () => okJson({ output: { category: "Invoice" } });

    const handler = createClassifierRunHandler();
    const inputState = makeFileInputState({
      uploadedFile: {
        fileId: "file_abc",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_abc`,
        mimeType: "application/pdf",
      },
    });

    await handler([inputState], { categories: [{ name: "Invoice" }] });
    await handler([inputState], { categories: [{ name: "Invoice" }] });

    const body = jsonBody(fetchCalls, 0);
    expect((body.document as { url: string }).url).toBe(
      `${STORAGE_PREFIX}file_abc`,
    );

    // Two classify calls, zero uploads.
    expect(fetchCalls).toHaveLength(2);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(uploadFileSpy).not.toHaveBeenCalled();
  });

  test("upload failure surfaces up and no classify request is sent", async () => {
    uploadMimeSpy?.mockImplementation(async () => {
      throw new Error("upload blew up");
    });
    fetchResponder = async () => okJson({ output: { category: "x" } });

    const handler = createClassifierRunHandler();
    const inputState = makeFileInputState();

    await expect(
      handler([inputState], { categories: [{ name: "Invoice" }] }),
    ).rejects.toThrow("upload blew up");

    expect(fetchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Parse playground
// ---------------------------------------------------------------------------

describe("parse run handler — URL-backed upload", () => {
  test("happy path: posts url-backed document to /v1/parses", async () => {
    fetchResponder = async () =>
      okJson({
        file: {
          id: "f1",
          filename: "invoice.pdf",
          mime_type: "application/pdf",
        },
        usage: { credits: 1 },
        output: { pages: ["a"], text: "a" },
      });

    const handler = createParseRunHandler();
    await handler([makeFileInputState()], {});

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe(`${BACKEND_BASE}/v1/parses`);
    assertUrlBackedBody(jsonBody(fetchCalls, 0));
    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);
  });

  test("re-run with cached uploadedFile skips upload", async () => {
    fetchResponder = async () =>
      okJson({
        file: {
          id: "f1",
          filename: "invoice.pdf",
          mime_type: "application/pdf",
        },
        usage: { credits: 1 },
        output: { pages: [], text: "" },
      });

    const handler = createParseRunHandler();
    const state = makeFileInputState({
      uploadedFile: {
        fileId: "file_stable",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_stable`,
        mimeType: "application/pdf",
      },
    });

    await handler([state], {});
    await handler([state], {});

    expect(fetchCalls).toHaveLength(2);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    for (const call of fetchCalls) {
      const body = JSON.parse(String(call.init.body));
      expect(body.document.url).toBe(`${STORAGE_PREFIX}file_stable`);
    }
  });

  test("upload failure surfaces and does not call parse endpoint", async () => {
    uploadMimeSpy?.mockImplementation(async () => {
      throw new Error("network fell over");
    });

    const handler = createParseRunHandler();
    await expect(handler([makeFileInputState()], {})).rejects.toThrow(
      "network fell over",
    );
    expect(fetchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Split playground
// ---------------------------------------------------------------------------

describe("split run handler — URL-backed upload", () => {
  test("happy path: posts url-backed document to /v1/splits", async () => {
    fetchResponder = async () => okJson({ output: [{ name: "section-a" }] });

    const handler = createSplitRunHandler();
    await handler([makeFileInputState()], {
      instructions: "Use section headers.",
      subdocuments: [{ name: "a" }],
    } as Record<string, unknown>);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe(`${BACKEND_BASE}/v1/splits`);
    const body = jsonBody(fetchCalls, 0);
    assertUrlBackedBody(body);
    expect(body.instructions).toBe("Use section headers.");
  });

  test("re-run does not re-upload when uploadedFile is present", async () => {
    fetchResponder = async () => okJson({ output: [] });

    const handler = createSplitRunHandler();
    const state = makeFileInputState({
      uploadedFile: {
        fileId: "file_split",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_split`,
        mimeType: "application/pdf",
      },
    });

    await handler([state], { subdocuments: [{ name: "a" }] });
    await handler([state], { subdocuments: [{ name: "a" }] });

    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(uploadFileSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(2);
  });

  test("upload failure aborts the run", async () => {
    uploadMimeSpy?.mockImplementation(async () => {
      throw new Error("upload rejected");
    });

    const handler = createSplitRunHandler();
    await expect(
      handler([makeFileInputState()], { subdocuments: [{ name: "a" }] }),
    ).rejects.toThrow("upload rejected");
    expect(fetchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Partition playground
// ---------------------------------------------------------------------------

describe("partition run handler — URL-backed upload", () => {
  test("happy path: posts url-backed document to /v1/partitions", async () => {
    fetchResponder = async () => okJson({ output: [] });

    const handler = createPartitionRunHandler();
    await handler([makeFileInputState()], {
      key: "chunks",
      instructions: "split by section",
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe(`${BACKEND_BASE}/v1/partitions`);
    assertUrlBackedBody(jsonBody(fetchCalls, 0));
  });

  test("re-run with uploadedFile does not upload twice", async () => {
    fetchResponder = async () => okJson({ output: [] });

    const handler = createPartitionRunHandler();
    const state = makeFileInputState({
      uploadedFile: {
        fileId: "file_part",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_part`,
        mimeType: "application/pdf",
      },
    });

    await handler([state], { key: "k", instructions: "i" });
    await handler([state], { key: "k", instructions: "i" });

    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(2);
  });

  test("upload failure stops the run", async () => {
    uploadMimeSpy?.mockImplementation(async () => {
      throw new Error("boom");
    });
    const handler = createPartitionRunHandler();
    await expect(
      handler([makeFileInputState()], { key: "k", instructions: "i" }),
    ).rejects.toThrow("boom");
    expect(fetchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Agent-edit playground
// ---------------------------------------------------------------------------

describe("agent-edit run handler — URL-backed upload", () => {
  test("happy path: posts url-backed document to both template-generate and /v1/edits", async () => {
    fetchResponder = async (url: string) => {
      if (url.endsWith("/v1/edits/templates/generate")) {
        return okJson({ form_schema: { form_fields: [] } });
      }
      return okJson({
        data: { form_data: [], filled_document: { url: "" } },
        form_data: [],
        filled_document: { url: "" },
      });
    };

    const handler = createAgentEditRunHandler();
    const documentState = makeFileInputState({ id: "document" });
    const instructionsState: InputState = {
      id: "instructions",
      type: "json",
      fileBuffer: null,
      fileName: null,
      fileMimeType: "application/json",
      uploadedFile: null,
      textValue: "fill all the fields",
    } as InputState;

    await handler([documentState, instructionsState], {
      instructions: "fill all the fields",
    });

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    // Every outgoing call must include the url-backed document payload.
    for (const call of fetchCalls) {
      const body = JSON.parse(String(call.init.body));
      assertUrlBackedBody(body);
    }
    // inputStateToUrlBackedMIMEData should only have been invoked once — the
    // payload is reused across the template-generate + edit requests.
    expect(urlBackedMimeSpy).toHaveBeenCalledTimes(1);
    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);
  });

  test("re-run with uploadedFile skips upload entirely", async () => {
    fetchResponder = async (url: string) => {
      if (url.endsWith("/v1/edits/templates/generate")) {
        return okJson({ form_schema: { form_fields: [] } });
      }
      return okJson({
        data: { form_data: [], filled_document: { url: "" } },
        form_data: [],
        filled_document: { url: "" },
      });
    };

    const handler = createAgentEditRunHandler();
    const documentState = makeFileInputState({
      id: "document",
      uploadedFile: {
        fileId: "file_ae",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_ae`,
        mimeType: "application/pdf",
      },
    });
    const instructionsState: InputState = {
      id: "instructions",
      type: "json",
      fileBuffer: null,
      fileName: null,
      fileMimeType: "application/json",
      uploadedFile: null,
      textValue: "fill",
    } as InputState;

    await handler([documentState, instructionsState], {});
    await handler([documentState, instructionsState], {});

    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(uploadFileSpy).not.toHaveBeenCalled();
  });

  test("upload failure propagates", async () => {
    uploadMimeSpy?.mockImplementation(async () => {
      throw new Error("upload failed");
    });
    const handler = createAgentEditRunHandler();
    const documentState = makeFileInputState({ id: "document" });
    const instructionsState: InputState = {
      id: "instructions",
      type: "json",
      fileBuffer: null,
      fileName: null,
      fileMimeType: "application/json",
      uploadedFile: null,
      textValue: "fill",
    } as InputState;

    await expect(
      handler([documentState, instructionsState], {}),
    ).rejects.toThrow("upload failed");
    expect(fetchCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Extract playground
// ---------------------------------------------------------------------------

describe("extract run handler — URL-backed upload", () => {
  test("streams delta.content into partial output before final full_parsed chunk", async () => {
    const finalOutput = {
      bank_name: "Commerce Bank",
      ending_balance: "10521,19",
    };
    fetchResponder = async () => {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "extraction_started",
                extraction_id: "extr_partial",
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: JSON.stringify({ type: "extraction_started" }),
                    },
                  },
                ],
              })}\n`,
            ),
          );
          for (const content of [
            '{"bank_name":"Com',
            'merce Bank","ending_balance":"105',
            '21,19"}',
          ]) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({
                  type: "structured_llm_delta",
                  extraction_id: "extr_partial",
                  choices: [{ index: 0, delta: { content } }],
                })}\n`,
              ),
            );
          }
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                extraction_id: "extr_partial",
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: JSON.stringify(finalOutput),
                      full_parsed: finalOutput,
                    },
                  },
                ],
              })}\n`,
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    };

    const progressOutputs: Record<string, unknown>[] = [];
    const handler = createExtractRunHandler(
      {
        type: "object",
        properties: {
          bank_name: { type: "string" },
          ending_balance: { type: "string" },
        },
      } as any,
      0,
      () => {},
    );

    const result = await handler(
      [makeFileInputState()],
      { json_schema: undefined },
      {
        onProgress: (state) => {
          progressOutputs.push(
            (state as { output: Record<string, unknown> }).output,
          );
        },
      },
    );

    expect(progressOutputs).toContainEqual({ bank_name: "Com" });
    expect(progressOutputs).toContainEqual({
      bank_name: "Commerce Bank",
      ending_balance: "105",
    });
    expect(progressOutputs).not.toContainEqual({
      type: "extraction_started",
    });
    expect(result.output).toEqual(finalOutput);
  });

  test("happy path: streams url-backed document to /v1/extractions/stream", async () => {
    // The handler calls fetchWithAuth and then streams the body — we make it
    // resolve with a Response whose body is consumed by the caller. The
    // caller uses `response.ok` + body streaming; returning a plain OK
    // response with a tiny JSON payload is enough to satisfy the code path
    // up to the network call we care about.
    fetchResponder = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"type":"done","extraction":{"id":"x","output":{}}}\n\n',
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    };

    const handler = createExtractRunHandler(
      { type: "object", properties: { name: { type: "string" } } } as any,
      0,
      () => {},
    );

    try {
      await handler([makeFileInputState()], { json_schema: undefined });
    } catch {
      // The streaming tail may throw depending on auxiliary utilities in
      // the handler; what we care about is the request we made BEFORE the
      // network roundtrip resolves. Proceed to the assertions.
    }

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    const extractionCall = fetchCalls.find((c) =>
      c.url.endsWith("/v1/extractions/stream"),
    );
    expect(extractionCall).toBeDefined();
    const body = JSON.parse(String(extractionCall!.init.body));
    assertUrlBackedBody(body);
  });

  test("re-run with cached uploadedFile skips upload", async () => {
    fetchResponder = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    };

    const handler = createExtractRunHandler(
      { type: "object", properties: { name: { type: "string" } } } as any,
      0,
      () => {},
    );
    const state = makeFileInputState({
      uploadedFile: {
        fileId: "file_extract",
        filename: "invoice.pdf",
        url: `${STORAGE_PREFIX}file_extract`,
        mimeType: "application/pdf",
      },
    });

    try {
      await handler([state], { json_schema: undefined });
      await handler([state], { json_schema: undefined });
    } catch {
      // Streaming tail may throw; we only care about upload + request behaviour.
    }

    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(uploadFileSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression: loadFileIntoInputState clears stale uploadedFile synchronously
// ---------------------------------------------------------------------------
//
// Previous bug: GenericInputNode.loadFile did
//   1. buffer = await file.arrayBuffer()
//   2. uploaded = await uploadRetabFile(file)
//   3. onStateChange({ …, uploadedFile: uploaded })
// in that order. Between the user selecting a new file and step 3 completing,
// the state still held the PREVIOUS file's uploadedFile. If Run fired in that
// window, inputStateToUrlBackedMIMEData returned the cached (old) URL and the
// backend received a pointer to the wrong document — a silent correctness bug.
//
// Fix: clear uploadedFile synchronously at the top of loadFile (before any
// await), then kick off the upload, then replace the state with the final
// uploadedFile record. These tests exercise loadFileIntoInputState (the
// exported pure helper behind loadFile) to pin that invariant.

describe("loadFileIntoInputState: clears stale uploadedFile synchronously", () => {
  test("issues a synchronous onStateChange that clears uploadedFile before any await resolves", async () => {
    const staleUploaded = {
      fileId: "file_OLD",
      filename: "file1.pdf",
      url: `${STORAGE_PREFIX}file_OLD`,
      mimeType: "application/pdf",
    };
    const priorState = makeFileInputState({
      fileName: "file1.pdf",
      uploadedFile: staleUploaded,
    });

    // Block the upload indefinitely so only synchronous work can have happened.
    let resolveUpload: (v: {
      fileId: string;
      filename: string;
      url: string;
      mimeType: string;
    }) => void = () => {};
    uploadFileSpy?.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const onStateChange = (() => {
      const calls: InputState[] = [];
      const fn = (next: InputState) => {
        calls.push(next);
      };
      (fn as unknown as { calls: InputState[] }).calls = calls;
      return fn as ((next: InputState) => void) & { calls: InputState[] };
    })();

    const newFile = new File([new Uint8Array([9, 9, 9])], "file2.pdf", {
      type: "application/pdf",
    });

    // Fire-and-forget — we intentionally do not await so we can observe the
    // state of the world *during* the upload window.
    const pending = loadFileIntoInputState(priorState, newFile, onStateChange);

    // Microtask turn so any synchronous scheduling flushes.
    await Promise.resolve();

    expect(onStateChange.calls.length).toBeGreaterThanOrEqual(1);
    const firstCall = onStateChange.calls[0]!;
    expect(firstCall.uploadedFile).toBeNull();
    expect(firstCall.fileName).toBe("file2.pdf");

    // Unblock the upload so the promise resolves cleanly.
    resolveUpload({
      fileId: "file_NEW",
      filename: "file2.pdf",
      url: `${STORAGE_PREFIX}file_NEW`,
      mimeType: "application/pdf",
    });
    await pending;

    // Post-upload state carries the NEW uploadedFile.
    const finalCall = onStateChange.calls[onStateChange.calls.length - 1]!;
    expect(finalCall.uploadedFile?.url).toBe(`${STORAGE_PREFIX}file_NEW`);
    expect(finalCall.fileName).toBe("file2.pdf");
  });

  test("a run that fires mid-upload against the cleared state does NOT reuse the previous URL", async () => {
    // End-to-end version of the invariant: after loadFileIntoInputState has
    // emitted its synchronous clearing state, a Run handler that consumes
    // that state must not send the old uploaded URL to the backend.
    fetchResponder = async () => okJson({ output: { category: "x" } });

    const priorState = makeFileInputState({
      fileName: "file1.pdf",
      uploadedFile: {
        fileId: "file_OLD",
        filename: "file1.pdf",
        url: `${STORAGE_PREFIX}file_OLD`,
        mimeType: "application/pdf",
      },
    });

    let latestState: InputState = priorState;
    const onStateChange = (next: InputState) => {
      latestState = next;
    };

    // Block the upload so the run fires strictly between the sync-clear and
    // the post-upload state emission.
    let resolveUpload: (v: {
      fileId: string;
      filename: string;
      url: string;
      mimeType: string;
    }) => void = () => {};
    uploadFileSpy?.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const newFile = new File([new Uint8Array([9, 9, 9])], "file2.pdf", {
      type: "application/pdf",
    });

    const pending = loadFileIntoInputState(priorState, newFile, onStateChange);
    // Allow the await file.arrayBuffer() microtask to resolve so the upload
    // step is the one in-flight.
    await Promise.resolve();
    await Promise.resolve();

    // The UI now has the sync-cleared state. A Run firing here must not
    // send the OLD URL. Because fileBuffer is null in the cleared state,
    // the handler should reject cleanly ("File input is missing") rather
    // than quietly shipping the previous uploadedFile.
    const handler = createClassifierRunHandler();
    let threw = false;
    try {
      await handler([latestState], { categories: [{ name: "x" }] });
    } catch {
      threw = true;
    }

    // Either the handler errored, or — if a future fix decides to upload the
    // staged buffer mid-window — the URL is NEW, never the stale OLD one.
    if (!threw) {
      expect(fetchCalls.length).toBeGreaterThan(0);
      const body = jsonBody(fetchCalls, 0);
      const doc = body.document as { url: string };
      expect(doc.url).not.toBe(`${STORAGE_PREFIX}file_OLD`);
    } else {
      expect(fetchCalls).toHaveLength(0);
    }

    resolveUpload({
      fileId: "file_NEW",
      filename: "file2.pdf",
      url: `${STORAGE_PREFIX}file_NEW`,
      mimeType: "application/pdf",
    });
    await pending;
  });
});
