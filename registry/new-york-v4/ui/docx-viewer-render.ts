import type * as DocxPreview from "docx-preview";

import { ViewerFormatError } from "@/lib/viewer-errors";

import {
  DEFAULT_DOCX_PAGE_HEIGHT,
  DEFAULT_DOCX_PAGE_WIDTH,
  DOCX_RENDER_OPTIONS,
  positivePixel,
} from "./docx-viewer-core";
import { createDocxPageLayout } from "./docx-viewer-layout";

let docxPromise: Promise<typeof DocxPreview> | null = null;

export function loadDocxPreview() {
  if (!docxPromise) {
    docxPromise = import("docx-preview").catch((error) => {
      docxPromise = null;
      throw error;
    });
  }
  return docxPromise;
}

export async function renderDocxPreview(
  buffer: ArrayBuffer,
  docxPreviewPromise = loadDocxPreview(),
) {
  const { renderAsync } = await docxPreviewPromise;
  const renderHost = document.createElement("div");
  await renderAsync(buffer, renderHost, undefined, DOCX_RENDER_OPTIONS);
  return renderHost;
}

export function commitDocxRender({
  host,
  renderHost,
  scale,
}: {
  host: HTMLElement;
  renderHost: HTMLElement;
  scale: number;
}) {
  const pages = Array.from(
    renderHost.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"),
  );
  if (!pages.length) {
    throw new ViewerFormatError({
      format: "docx",
      kind: "render_failed",
      message: "DOCX render produced no pages.",
    });
  }
  const z = scale || 1;
  const sizes = pages.map((el) => pageSize(el, z));
  pages.forEach((el, i) => {
    el.dataset.pageNumber = String(i + 1);
    el.style.contentVisibility = "auto";
    el.style.containIntrinsicSize = `${sizes[i][0]}px ${sizes[i][1]}px`;
  });
  const pageLayout = createDocxPageLayout(sizes);
  host.replaceChildren(...Array.from(renderHost.childNodes));
  return {
    numPages: pages.length,
    pageWidth: pages.length ? sizes[0][0] : null,
    pageLayout,
  };
}

function pageSize(el: HTMLElement, scale: number) {
  const styledWidth = positivePixel(Math.round(cssLengthToPx(el.style.width)));
  const styledHeight = positivePixel(
    Math.round(
      cssLengthToPx(el.style.height) || cssLengthToPx(el.style.minHeight),
    ),
  );
  if (styledWidth && styledHeight) {
    return [styledWidth, styledHeight] as const;
  }

  const r = el.getBoundingClientRect();
  const width = positivePixel(Math.round(r.width / scale));
  const height = positivePixel(Math.round(r.height / scale));
  return [
    styledWidth ?? width ?? DEFAULT_DOCX_PAGE_WIDTH,
    styledHeight ?? height ?? DEFAULT_DOCX_PAGE_HEIGHT,
  ] as const;
}

function cssLengthToPx(value: string) {
  const match = value.trim().match(/^(-?\d*\.?\d+)(px|pt|in|cm|mm|pc)?$/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const unit = (match[2] ?? "px").toLowerCase();
  if (unit === "px") return amount;
  if (unit === "pt") return (amount * 96) / 72;
  if (unit === "in") return amount * 96;
  if (unit === "cm") return (amount * 96) / 2.54;
  if (unit === "mm") return (amount * 96) / 25.4;
  if (unit === "pc") return amount * 16;
  return 0;
}
