import { DatasetDocument } from "@/components/json-table/lib/projects-types";

const setAllFlagsTrue = (node: any): any => {
  if (typeof node === "boolean") return true;
  if (Array.isArray(node)) return node.map(setAllFlagsTrue);
  if (node && typeof node === "object") {
    const out: any = {};
    for (const k of Object.keys(node)) out[k] = setAllFlagsTrue(node[k]);
    return out;
  }
  return node;
};

export const markDocumentAsVerified = (
  doc: DatasetDocument,
  updateDatasetDocument: (docId: string, patch: any) => Promise<any>,
) => {
  const prev = (doc?.validation_flags as any) || {};
  const next = setAllFlagsTrue(prev);
  const patch: Partial<DatasetDocument> = { validation_flags: next };
  updateDatasetDocument(doc.id, patch);
  return true;
};

// Helper: Get flag value at a specific path in the flags tree
export const getFlagAtPath = (
  flagsTree: any,
  dotPath: string,
): boolean | undefined => {
  if (!flagsTree || !dotPath) return undefined;
  const segments = dotPath.split(".").map((seg) => {
    const n = Number(seg);
    return Number.isFinite(n) && String(n) === seg ? n : seg;
  });
  let node: any = flagsTree;
  for (const seg of segments) {
    if (node == null) return undefined;
    node =
      Array.isArray(node) || typeof node === "object"
        ? (node as any)[seg as any]
        : undefined;
  }
  return typeof node === "boolean" ? node : undefined;
};

// Helper: Set flag value at a specific path in the flags tree
const setFlagAtPath = (
  flagsTree: any,
  dotPath: string,
  value: boolean,
): any => {
  if (!dotPath) return flagsTree;
  const segments = dotPath.split(".").map((seg) => {
    const n = Number(seg);
    return Number.isFinite(n) && String(n) === seg ? n : seg;
  });

  const recur = (node: any, segs: (string | number)[]): any => {
    if (segs.length === 0) return value;
    const [head, ...tail] = segs;
    if (typeof head === "number") {
      const arr = Array.isArray(node) ? [...node] : [];
      arr[head] = recur(arr[head], tail);
      return arr;
    }
    const obj =
      node && typeof node === "object" && !Array.isArray(node)
        ? { ...node }
        : {};
    obj[head] = recur(obj[head], tail);
    return obj;
  };

  return recur(flagsTree || {}, segments);
};

export const toggleValidity = async (
  doc: DatasetDocument,
  fieldPath: string,
  updateDocument: (docId: string, patch: any) => Promise<any>,
) => {
  if (!doc || !fieldPath) return;
  const currentValue = getFlagAtPath(doc.validation_flags, fieldPath);
  const newValue = !currentValue;
  const updatedFlags = setFlagAtPath(doc.validation_flags, fieldPath, newValue);
  await updateDocument(doc.id, { validation_flags: updatedFlags });
};
