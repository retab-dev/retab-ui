// Unit tests for inputStateToUrlBackedMIMEData and supplemental integration
// coverage for the "file replaced" and "empty/missing file" paths that the
// sibling run-handlers-url-upload.test.ts does not cover.
//
// Uses spyOn on namespace imports (NOT mock.module) — see
// memory/reference_bun_mock_module_leak.md for why.

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import * as filesModule from "@/app/dashboard/shared/files/queries/files";
import * as authUtils from "@/backend/client-auth-utils";

import {
  clearInputStateUploadCacheForTests,
  inputStateToUrlBackedMIMEData,
} from "./upload-input-state";
import { createClassifierRunHandler } from "./classifier-playground";
import { createParseRunHandler } from "./parse-playground";
import { createSplitRunHandler } from "./split-playground";
import { createPartitionRunHandler } from "./partition-playground";
import { createAgentEditRunHandler } from "./agent-edit-playground";
import { createExtractRunHandler } from "./extract-playground";

import type { InputState } from "./execute-playground";

const STORAGE_PREFIX = "https://storage.retab.com/";
const BACKEND_BASE = "https://api.retab.test";

type CapturedCall = { url: string; init: RequestInit };

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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

function makeEmptyFileInputState(
  overrides: Partial<InputState> = {},
): InputState {
  return {
    id: "document",
    type: "file",
    fileBuffer: null,
    fileName: null,
    fileMimeType: "application/pdf",
    uploadedFile: null,
    textValue: "",
    ...overrides,
  } as InputState;
}

// ---------------------------------------------------------------------------
// Direct helper tests — inputStateToUrlBackedMIMEData
// ---------------------------------------------------------------------------

describe("inputStateToUrlBackedMIMEData helper", () => {
  let uploadMimeSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    uploadMimeSpy = spyOn(
      filesModule,
      "uploadRetabFileAsMIMEData",
    ).mockImplementation(async (file: File) => ({
      filename: file.name,
      url: `${STORAGE_PREFIX}file_${file.name}`,
    }));
  });

  afterEach(() => {
    uploadMimeSpy?.mockRestore();
    clearInputStateUploadCacheForTests();
  });

  test("returns cached upload payload verbatim when uploadedFile is present", async () => {
    const state = makeFileInputState({
      uploadedFile: {
        fileId: "file_cached",
        filename: "cached.pdf",
        url: `${STORAGE_PREFIX}file_cached`,
        mimeType: "application/pdf",
      },
    });

    const result = await inputStateToUrlBackedMIMEData(state);

    expect(result).toEqual({
      filename: "cached.pdf",
      url: `${STORAGE_PREFIX}file_cached`,
    });
    expect(uploadMimeSpy).not.toHaveBeenCalled();
  });

  test("falls back to uploadRetabFileAsMIMEData when uploadedFile is null but buffer exists", async () => {
    const state = makeFileInputState();

    const result = await inputStateToUrlBackedMIMEData(state);

    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);
    expect(result.url.startsWith(STORAGE_PREFIX)).toBe(true);
  });

  test("reuses the upload for identical file content when uploadedFile is absent", async () => {
    uploadMimeSpy?.mockImplementation(async (file: File) => ({
      filename: file.name,
      url: `${STORAGE_PREFIX}upload_${uploadMimeSpy?.mock.calls.length}`,
    }));
    const firstState = makeFileInputState({
      fileBuffer: new Uint8Array([10, 20, 30]).buffer,
      fileName: "repeat.pdf",
    });
    const secondState = makeFileInputState({
      fileBuffer: new Uint8Array([10, 20, 30]).buffer,
      fileName: "repeat.pdf",
    });

    const first = await inputStateToUrlBackedMIMEData(firstState);
    const second = await inputStateToUrlBackedMIMEData(secondState);

    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  test("throws when fileBuffer is missing and no uploadedFile is cached", async () => {
    const state = makeEmptyFileInputState();

    await expect(inputStateToUrlBackedMIMEData(state)).rejects.toThrow(
      "File input is missing",
    );
    expect(uploadMimeSpy).not.toHaveBeenCalled();
  });

  test("defaults filename to 'document' when fileName is null", async () => {
    const buffer = new Uint8Array([9]).buffer;
    uploadMimeSpy?.mockImplementation(async (file: File) => ({
      filename: file.name,
      url: `${STORAGE_PREFIX}${file.name}`,
    }));
    const state: InputState = {
      id: "document",
      type: "file",
      fileBuffer: buffer,
      fileName: null,
      fileMimeType: "application/pdf",
      uploadedFile: null,
      textValue: "",
    } as InputState;

    const result = await inputStateToUrlBackedMIMEData(state);

    expect(result.filename).toBe("document");
  });

  test("preserves mime type when constructing the File", async () => {
    let seenType = "";
    uploadMimeSpy?.mockImplementation(async (file: File) => {
      seenType = file.type;
      return {
        filename: file.name,
        url: `${STORAGE_PREFIX}${file.name}`,
      };
    });
    const state = makeFileInputState({ fileMimeType: "application/pdf" });

    await inputStateToUrlBackedMIMEData(state);

    expect(seenType).toBe("application/pdf");
  });
});

// ---------------------------------------------------------------------------
// Playground integration: file replaced → upload fires again
// Executes the expected state transition when a user clears uploadedFile
// alongside loading a new buffer. Confirms the handler will re-upload.
// ---------------------------------------------------------------------------

describe("playground run handler — file replacement triggers a new upload", () => {
  const fetchCalls: CapturedCall[] = [];
  let fetchSpy: ReturnType<typeof spyOn> | null = null;
  let uploadMimeSpy: ReturnType<typeof spyOn> | null = null;
  let uploadFileSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL = BACKEND_BASE;
    fetchCalls.length = 0;

    fetchSpy = spyOn(authUtils, "fetchWithAuth").mockImplementation((async (
      url: string,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url, init: init ?? {} });
      return okJson({ output: { category: "x" } });
    }) as unknown as typeof authUtils.fetchWithAuth);

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
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    uploadFileSpy?.mockRestore();
    uploadMimeSpy?.mockRestore();
    clearInputStateUploadCacheForTests();
    delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  });

  test("classifier: after a first upload, clearing uploadedFile + new buffer triggers a second upload", async () => {
    const handler = createClassifierRunHandler();
    const firstState = makeFileInputState({ fileName: "first.pdf" });

    await handler([firstState], { categories: [{ name: "Invoice" }] });
    expect(uploadMimeSpy).toHaveBeenCalledTimes(1);

    // User replaces the file → loadFile() sets new buffer + new uploadedFile
    // sequentially. Defensive flow clears uploadedFile at selection time.
    // Execute that ideal behaviour: the next run sees a fresh buffer and a
    // cleared uploadedFile, so the handler calls the upload helper again.
    const secondState = makeFileInputState({
      fileBuffer: new Uint8Array([5, 6, 7]).buffer,
      fileName: "second.pdf",
      uploadedFile: null,
    });

    await handler([secondState], { categories: [{ name: "Invoice" }] });

    expect(uploadMimeSpy).toHaveBeenCalledTimes(2);
    // The outgoing URLs must correspond to two different files.
    const firstBody = JSON.parse(String(fetchCalls[0]!.init.body));
    const secondBody = JSON.parse(String(fetchCalls[1]!.init.body));
    expect(firstBody.document.url).not.toBe(secondBody.document.url);
    expect(secondBody.document.url).toContain("second.pdf");
  });
});

// ---------------------------------------------------------------------------
// Playground integration: empty / missing file should short-circuit cleanly
// ---------------------------------------------------------------------------

describe("playground run handler — empty/missing file is rejected before upload", () => {
  const fetchCalls: CapturedCall[] = [];
  let fetchSpy: ReturnType<typeof spyOn> | null = null;
  let uploadMimeSpy: ReturnType<typeof spyOn> | null = null;
  let uploadFileSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL = BACKEND_BASE;
    fetchCalls.length = 0;

    fetchSpy = spyOn(authUtils, "fetchWithAuth").mockImplementation((async (
      url: string,
      init?: RequestInit,
    ) => {
      fetchCalls.push({ url, init: init ?? {} });
      return okJson({});
    }) as unknown as typeof authUtils.fetchWithAuth);

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
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    uploadFileSpy?.mockRestore();
    uploadMimeSpy?.mockRestore();
    clearInputStateUploadCacheForTests();
    delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  });

  test("classifier throws before upload and before fetch when no file selected", async () => {
    const handler = createClassifierRunHandler();
    await expect(
      handler([makeEmptyFileInputState()], {
        categories: [{ name: "Invoice" }],
      }),
    ).rejects.toThrow(/upload a document|provide input/i);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  test("parse throws before upload when no file selected", async () => {
    const handler = createParseRunHandler();
    await expect(handler([makeEmptyFileInputState()], {})).rejects.toThrow(
      /upload a document/i,
    );
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  test("split throws before upload when no file selected", async () => {
    const handler = createSplitRunHandler();
    await expect(
      handler([makeEmptyFileInputState()], {
        subdocuments: [{ name: "a" }],
      }),
    ).rejects.toThrow(/upload a document/i);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  test("partition throws before upload when no file selected", async () => {
    const handler = createPartitionRunHandler();
    await expect(
      handler([makeEmptyFileInputState()], {
        key: "chunks",
        instructions: "split",
      }),
    ).rejects.toThrow(/upload a document/i);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  test("agent-edit throws before upload when no file selected", async () => {
    const handler = createAgentEditRunHandler();
    const documentState = makeEmptyFileInputState({ id: "document" });
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
    ).rejects.toThrow(/upload a document/i);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });

  test("extract throws before upload when no file selected", async () => {
    const handler = createExtractRunHandler(
      { type: "object", properties: { name: { type: "string" } } } as any,
      0,
      () => {},
    );
    await expect(
      handler([makeEmptyFileInputState()], { json_schema: undefined }),
    ).rejects.toThrow(/upload a document/i);
    expect(uploadMimeSpy).not.toHaveBeenCalled();
    expect(fetchCalls).toHaveLength(0);
  });
});
