"use client";

import JSZip from "jszip";
import type { DocumentProps, PageProps } from "react-pdf";

// Centralized PDF.js initialization to avoid race conditions
// All PDF-related files should use these exports instead of their own initialization
let pdfjsLib: typeof import("react-pdf").pdfjs | null = null;
let ReactPdfDocument: React.ComponentType<DocumentProps> | null = null;
let ReactPdfPage: React.ComponentType<PageProps> | null = null;
let initPromise: Promise<{
  pdfjs: typeof import("react-pdf").pdfjs;
  Document: React.ComponentType<DocumentProps>;
  Page: React.ComponentType<PageProps>;
}> | null = null;

/**
 * Get initialized react-pdf components and pdfjs library.
 * This uses a singleton promise to ensure:
 * 1. Only one import happens even if called from multiple places simultaneously
 * 2. Worker is configured before any PDF operations
 * 3. All callers wait for the same initialization
 */
export const getReactPdfComponents = async () => {
  // Return cached components if already loaded
  if (pdfjsLib && ReactPdfDocument && ReactPdfPage) {
    return { pdfjs: pdfjsLib, Document: ReactPdfDocument, Page: ReactPdfPage };
  }

  // Use a single promise to prevent race conditions during initialization
  if (!initPromise) {
    initPromise = (async () => {
      const { Document, Page, pdfjs } = await import("react-pdf");

      // Configure PDF.js worker - always set it unconditionally
      // This ensures the worker is configured before any Document loads
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      pdfjsLib = pdfjs;
      ReactPdfDocument = Document;
      ReactPdfPage = Page;
      return { pdfjs, Document, Page };
    })();
  }

  return initPromise;
};

// Legacy function for backward compatibility - uses getReactPdfComponents internally
const getPdfjs = async () => {
  const { pdfjs } = await getReactPdfComponents();
  return pdfjs;
};

export const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const isDocxFile = (file: File) =>
  file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  file.name.toLowerCase().endsWith(".docx");

const isOdtFile = (file: File) =>
  file.type === "application/vnd.oasis.opendocument.text" ||
  file.name.toLowerCase().endsWith(".odt");

export const isWordFile = (file: File) =>
  isDocxFile(file) ||
  isOdtFile(file) ||
  file.type === "application/msword" ||
  file.name.toLowerCase().endsWith(".doc");

const isPptxFile = (file: File) =>
  file.type ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
  file.name.toLowerCase().endsWith(".pptx");

const isOdpFile = (file: File) =>
  file.type === "application/vnd.oasis.opendocument.presentation" ||
  file.name.toLowerCase().endsWith(".odp");

export const isPowerPointFile = (file: File) =>
  isPptxFile(file) ||
  isOdpFile(file) ||
  file.type === "application/vnd.ms-powerpoint" ||
  file.name.toLowerCase().endsWith(".ppt");

// Best-effort client-side MIME sniffing from magic bytes
const sniffMimeType = async (file: File): Promise<string | null> => {
  try {
    const slice = file.slice(0, 16);
    const buf = new Uint8Array(await slice.arrayBuffer());
    // PDF: %PDF
    if (
      buf.length >= 4 &&
      buf[0] === 0x25 &&
      buf[1] === 0x50 &&
      buf[2] === 0x44 &&
      buf[3] === 0x46
    ) {
      return "application/pdf";
    }
    // PNG
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      return "image/png";
    }
    // JPEG
    if (
      buf.length >= 3 &&
      buf[0] === 0xff &&
      buf[1] === 0xd8 &&
      buf[2] === 0xff
    ) {
      return "image/jpeg";
    }
    // GIF
    if (
      buf.length >= 6 &&
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61
    ) {
      return "image/gif";
    }
    // WEBP: RIFF....WEBP
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    ) {
      return "image/webp";
    }
    // ZIP (OOXML/ODF often start with PK\x03\x04). We don't distinguish here; keep browser type.
    if (
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
      (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
    ) {
      return null; // leave as-is; further checks will inspect internals
    }
    return null;
  } catch {
    return null;
  }
};

// Return a new File with corrected MIME type if we can confidently detect it. Keeps name unchanged.
const normalizeFileType = async (file: File): Promise<File> => {
  const sniffed = await sniffMimeType(file);
  if (sniffed && sniffed !== file.type) {
    const buf = await file.arrayBuffer();
    return new File([buf], file.name, { type: sniffed });
  }
  return file;
};

// Result of corruption check with optional reason
type CorruptionResult =
  | { corrupted: false }
  | { corrupted: true; reason: string };

// Attempts a lightweight integrity check per format. Returns corruption status with reason.
const checkFileCorruption = async (file: File): Promise<CorruptionResult> => {
  try {
    // Trivially empty
    if (!file || file.size === 0) {
      return { corrupted: true, reason: "File is empty (0 bytes)" };
    }

    if (isPdfFile(file)) {
      try {
        const pdfjs = await getPdfjs();
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const loadingTask = pdfjs.getDocument({
          data: uint8,
          stopAtErrors: true,
        });
        const doc = await loadingTask.promise;
        try {
          await (doc as any).cleanup?.();
        } catch {}
        try {
          (doc as any).destroy?.();
        } catch {}
        return { corrupted: false };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        // Don't treat worker/infrastructure errors as corruption
        const isInfraError =
          message.includes("worker") ||
          message.includes("Worker") ||
          message.includes("module specifier") ||
          message.includes("network") ||
          message.includes("fetch");
        if (isInfraError) {
          // Can't verify - assume file is OK
          console.warn(
            `PDF validation skipped due to infrastructure error: ${message}`,
          );
          return { corrupted: false };
        }
        return { corrupted: true, reason: `Invalid PDF structure: ${message}` };
      }
    }

    // OOXML: DOCX/PPTX should be valid ZIPs with core parts
    if (isDocxFile(file)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        // Presence of core parts indicates a readable document
        if (zip.file("[Content_Types].xml") || zip.file("word/document.xml")) {
          return { corrupted: false };
        }
        return {
          corrupted: true,
          reason:
            "Invalid DOCX: missing required document structure (Content_Types.xml or word/document.xml)",
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return { corrupted: true, reason: `Invalid DOCX archive: ${message}` };
      }
    }

    if (isPptxFile(file)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        if (
          zip.file("[Content_Types].xml") ||
          zip.file("ppt/presentation.xml")
        ) {
          return { corrupted: false };
        }
        return {
          corrupted: true,
          reason:
            "Invalid PPTX: missing required presentation structure (Content_Types.xml or ppt/presentation.xml)",
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return { corrupted: true, reason: `Invalid PPTX archive: ${message}` };
      }
    }

    // ODF: ODT/ODP should be valid ZIPs with content.xml
    if (isOdtFile(file)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        if (zip.file("content.xml")) {
          return { corrupted: false };
        }
        return { corrupted: true, reason: "Invalid ODT: missing content.xml" };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return { corrupted: true, reason: `Invalid ODT archive: ${message}` };
      }
    }

    if (isOdpFile(file)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        if (zip.file("content.xml")) {
          return { corrupted: false };
        }
        return { corrupted: true, reason: "Invalid ODP: missing content.xml" };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return { corrupted: true, reason: `Invalid ODP archive: ${message}` };
      }
    }

    // For other formats we don't assert corruption here
    return { corrupted: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { corrupted: true, reason: `Failed to read file: ${message}` };
  }
};

export const countPdfPages = async (file: File): Promise<number> => {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data: uint8 });
  const doc = await loadingTask.promise;
  const pages = doc.numPages;
  try {
    await (doc as any).cleanup?.();
  } catch {}
  try {
    (doc as any).destroy?.();
  } catch {}
  return pages;
};

// Attempts to count pages in DOCX by reading docProps/app.xml <Pages>.
// Returns number on success; throws on hard errors; if metadata missing, throws to allow fallback policy.
export const countDocxPages = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const appXmlFile = zip.file("docProps/app.xml");
  if (!appXmlFile) {
    throw new Error("docProps/app.xml not found");
  }
  const appXml = await appXmlFile.async("text");
  const parser = new DOMParser();
  const xml = parser.parseFromString(appXml, "application/xml");
  const pagesNode = xml.getElementsByTagName("Pages")[0];
  if (!pagesNode || !pagesNode.textContent) {
    throw new Error("Pages metadata not found");
  }
  const pages = parseInt(pagesNode.textContent, 10);
  if (!Number.isFinite(pages) || pages <= 0) {
    throw new Error("Invalid Pages value");
  }
  return pages;
};

// Attempts to count pages in ODT by reading meta.xml meta:page-count attribute.
export const countOdtPages = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const metaXmlFile = zip.file("meta.xml");
  if (!metaXmlFile) {
    throw new Error("meta.xml not found");
  }
  const metaXml = await metaXmlFile.async("text");
  const parser = new DOMParser();
  const xml = parser.parseFromString(metaXml, "application/xml");
  // meta:document-statistic meta:page-count="N"
  const stats =
    xml.getElementsByTagName("meta:document-statistic")[0] ||
    xml.getElementsByTagName("document-statistic")[0];
  if (!stats) {
    throw new Error("document-statistic not found");
  }
  const attr =
    stats.getAttribute("meta:page-count") || stats.getAttribute("page-count");
  if (!attr) {
    throw new Error("page-count not found");
  }
  const pages = parseInt(attr, 10);
  if (!Number.isFinite(pages) || pages <= 0) {
    throw new Error("Invalid page-count value");
  }
  return pages;
};

// Attempts to count slides in PPTX by reading docProps/app.xml <Slides>.
export const countPptxSlides = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const appXmlFile = zip.file("docProps/app.xml");
  if (!appXmlFile) {
    throw new Error("docProps/app.xml not found");
  }
  const appXml = await appXmlFile.async("text");
  const parser = new DOMParser();
  const xml = parser.parseFromString(appXml, "application/xml");
  const slidesNode = xml.getElementsByTagName("Slides")[0];
  if (!slidesNode || !slidesNode.textContent) {
    throw new Error("Slides metadata not found");
  }
  const slides = parseInt(slidesNode.textContent, 10);
  if (!Number.isFinite(slides) || slides <= 0) {
    throw new Error("Invalid Slides value");
  }
  return slides;
};

// Attempts to count slides in ODP by reading meta.xml meta:slide-count attribute.
export const countOdpSlides = async (file: File): Promise<number> => {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const metaXmlFile = zip.file("meta.xml");
  if (!metaXmlFile) {
    throw new Error("meta.xml not found");
  }
  const metaXml = await metaXmlFile.async("text");
  const parser = new DOMParser();
  const xml = parser.parseFromString(metaXml, "application/xml");
  const stats =
    xml.getElementsByTagName("meta:document-statistic")[0] ||
    xml.getElementsByTagName("document-statistic")[0];
  if (!stats) {
    throw new Error("document-statistic not found");
  }
  const attr =
    stats.getAttribute("meta:slide-count") || stats.getAttribute("slide-count");
  if (!attr) {
    throw new Error("slide-count not found");
  }
  const slides = parseInt(attr, 10);
  if (!Number.isFinite(slides) || slides <= 0) {
    throw new Error("Invalid slide-count value");
  }
  return slides;
};

// Generic page counter for supported types. Throws if unsupported or cannot determine pages.
export const countPages = async (file: File): Promise<number> => {
  if (isPdfFile(file)) return countPdfPages(file);
  if (isDocxFile(file)) return countDocxPages(file);
  if (isOdtFile(file)) return countOdtPages(file);
  if (isPptxFile(file)) return countPptxSlides(file);
  if (isOdpFile(file)) return countOdpSlides(file);
  throw new Error("Unsupported file type for page counting");
};

export const splitByPdfLength = async (
  incomingFiles: File[],
): Promise<{
  accepted: File[];
  corrupted: { name: string; reason?: string }[];
}> => {
  const accepted: File[] = [];
  const corrupted: { name: string; reason?: string }[] = [];
  for (const f of incomingFiles) {
    // Correct obviously mislabeled files (e.g., PNG named .pdf)
    const normalized = await normalizeFileType(f);

    // Quick corruption check for supported document types and trivial empties
    const docLike =
      normalized.type === "application/pdf" ||
      isWordFile(normalized) ||
      isPowerPointFile(normalized);
    if (docLike || normalized.size === 0) {
      try {
        const result = await checkFileCorruption(normalized);
        if (result.corrupted) {
          corrupted.push({ name: normalized.name, reason: result.reason });
          continue;
        }
      } catch (e) {
        const reason =
          e instanceof Error ? e.message : "Unknown validation error";
        corrupted.push({ name: normalized.name, reason });
        continue;
      }
    }

    accepted.push(normalized);
  }
  return { accepted, corrupted };
};
