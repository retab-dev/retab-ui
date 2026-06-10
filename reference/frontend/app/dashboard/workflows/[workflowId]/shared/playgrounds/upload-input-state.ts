import { uploadRetabFileAsMIMEData } from "@/app/dashboard/shared/files/queries/files";

import type { InputState } from "./execute-playground";

type UrlBackedMIMEData = { filename: string; url: string };

const uploadByContentCache = new Map<string, Promise<UrlBackedMIMEData>>();

async function buildUploadCacheKey(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(buffer),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [filename, mimeType, buffer.byteLength, hash].join("\u0000");
}

export function clearInputStateUploadCacheForTests(): void {
  uploadByContentCache.clear();
}

export async function inputStateToUrlBackedMIMEData(
  inputState: InputState,
): Promise<UrlBackedMIMEData> {
  if (inputState.uploadedFile) {
    return {
      filename: inputState.uploadedFile.filename,
      url: inputState.uploadedFile.url,
    };
  }

  if (!inputState.fileBuffer) {
    throw new Error("File input is missing");
  }

  const filename = inputState.fileName || "document";
  const mimeType = inputState.fileMimeType || "application/octet-stream";
  const cacheKey = await buildUploadCacheKey(
    inputState.fileBuffer,
    filename,
    mimeType,
  );
  const cachedUpload = uploadByContentCache.get(cacheKey);
  if (cachedUpload) {
    return cachedUpload;
  }

  const file = new File([inputState.fileBuffer], filename, { type: mimeType });
  const upload = uploadRetabFileAsMIMEData(file);
  uploadByContentCache.set(cacheKey, upload);
  try {
    return await upload;
  } catch (error) {
    if (uploadByContentCache.get(cacheKey) === upload) {
      uploadByContentCache.delete(cacheKey);
    }
    throw error;
  }
}
