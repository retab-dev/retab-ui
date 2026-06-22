export type DropzoneAcceptRule =
  | { type: "any"; value: "*/*" }
  | { type: "extension"; value: string }
  | { type: "mime"; value: string }
  | { type: "mime-prefix"; value: string };

export type DropzoneFileRejection =
  | {
      file: File;
      reason: "file-invalid-type";
      acceptRules: DropzoneAcceptRule[];
    }
  | {
      file: File;
      reason: "file-too-large";
      maxSize: number;
    }
  | {
      file: File;
      reason: "too-many-files";
      maxFiles: number;
    }
  | {
      file: File;
      reason: "custom";
      code: string;
      details?: unknown;
    };

export type DropzoneIntake = {
  acceptedFiles: File[];
  fileRejections: DropzoneFileRejection[];
};

export function parseDropzoneAccept(accept?: string): DropzoneAcceptRule[] {
  if (!accept) return [];

  return accept
    .split(",")
    .map((rawToken) => rawToken.trim().toLowerCase())
    .filter(Boolean)
    .map((token): DropzoneAcceptRule => {
      if (token === "*/*") {
        return { type: "any", value: "*/*" };
      }
      if (token.startsWith(".")) {
        return { type: "extension", value: token };
      }
      if (token.endsWith("/*")) {
        return { type: "mime-prefix", value: token.slice(0, -1) };
      }
      return { type: "mime", value: token };
    });
}

export function formatDropzoneAccept(
  accept?: string | DropzoneAcceptRule[],
): string | undefined {
  if (!Array.isArray(accept)) return accept;

  return accept
    .map((rule) => {
      if (rule.type === "any") return rule.value;
      if (rule.type === "mime-prefix") return `${rule.value}*`;
      return rule.value;
    })
    .join(",");
}

export function matchesDropzoneAccept(
  file: File,
  accept?: string | DropzoneAcceptRule[],
): boolean {
  const acceptRules = Array.isArray(accept)
    ? accept
    : parseDropzoneAccept(accept);
  if (acceptRules.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return acceptRules.some((rule) => {
    if (rule.type === "any") return true;
    if (rule.type === "extension") return fileName.endsWith(rule.value);
    if (rule.type === "mime-prefix") return fileType.startsWith(rule.value);
    return fileType === rule.value;
  });
}

export function validateDropzoneFile(
  file: File,
  {
    accept,
    maxSize,
  }: {
    accept?: string | DropzoneAcceptRule[];
    maxSize?: number;
  },
): DropzoneFileRejection | null {
  if (!matchesDropzoneAccept(file, accept)) {
    return {
      file,
      reason: "file-invalid-type",
      acceptRules: Array.isArray(accept) ? accept : parseDropzoneAccept(accept),
    };
  }

  if (maxSize !== undefined && file.size > maxSize) {
    return {
      file,
      reason: "file-too-large",
      maxSize,
    };
  }

  return null;
}

export function validateDropzoneFiles(
  incomingFiles: File[],
  {
    accept,
    currentCount = 0,
    maxFiles,
    maxSize,
  }: {
    accept?: string | DropzoneAcceptRule[];
    currentCount?: number;
    maxFiles?: number;
    maxSize?: number;
  },
): DropzoneIntake {
  const acceptedFiles: File[] = [];
  const fileRejections: DropzoneFileRejection[] = [];
  const availableSlots =
    maxFiles === undefined ? Number.POSITIVE_INFINITY : maxFiles - currentCount;

  for (const file of incomingFiles) {
    const fileRejection = validateDropzoneFile(file, { accept, maxSize });
    if (fileRejection) {
      fileRejections.push(fileRejection);
      continue;
    }

    if (acceptedFiles.length >= availableSlots) {
      fileRejections.push({
        file,
        reason: "too-many-files",
        maxFiles: maxFiles ?? 0,
      });
      continue;
    }

    acceptedFiles.push(file);
  }

  return { acceptedFiles, fileRejections };
}
