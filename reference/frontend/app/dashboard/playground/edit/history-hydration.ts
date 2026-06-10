import type { FormField } from "@/app/dashboard/widgets/types/edit";
import type { Edit } from "@/types";

// The `/v1/edits` resource carries the model and instructions at the top level
// and the filled form fields + rendered PDF under `output` (an `EditResult`).
// These accessors read that canonical shape so history hydration matches the
// real payload.

export function getEditHistoryModel(edit: Edit): string | undefined {
  return edit.model;
}

export function getEditHistoryInstructions(edit: Edit): string {
  return edit.instructions ?? "";
}

export function getEditHistoryFormData(edit: Edit): FormField[] {
  return edit.output?.form_data ?? [];
}

export function getEditHistoryFilledDocument(
  edit: Edit,
): { filename?: string; url?: string } | undefined {
  return edit.output?.filled_document;
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  const base64Part = dataUrl.split(",")[1];
  if (!base64Part) return null;

  try {
    const binary = atob(base64Part);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

export function arrayBufferToDataUrl(
  buffer: ArrayBuffer,
  mimeType: string,
): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}
