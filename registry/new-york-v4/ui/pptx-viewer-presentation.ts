import { DEFAULT_PPTX_SLIDE_SIZE, type PptxSize } from "./pptx-viewer-core"

// EMU (English Metric Units) -> CSS px at 96dpi. OOXML measures in EMU;
// 914400 EMU = 1 inch, 96 px = 1 inch, so 9525 EMU = 1 px.
const EMU_PER_PX = 9525

export type PptxXmlParser = (xml: string) => Document | null

export function defaultPptxXmlParser(xml: string): Document | null {
  if (typeof DOMParser === "undefined") return null
  return new DOMParser().parseFromString(xml, "application/xml")
}

export function parsePptxSlideSize(
  xml: string | null | undefined,
  parseXml: PptxXmlParser = defaultPptxXmlParser
): PptxSize {
  if (!xml) {
    return DEFAULT_PPTX_SLIDE_SIZE
  }

  let document: Document | null
  try {
    document = parseXml(xml)
  } catch {
    return DEFAULT_PPTX_SLIDE_SIZE
  }
  if (!document) return DEFAULT_PPTX_SLIDE_SIZE

  const parseError = document.getElementsByTagName("parsererror")[0]
  if (parseError) return DEFAULT_PPTX_SLIDE_SIZE

  const slideSize = [...document.getElementsByTagName("*")].find(
    (element) => element.localName === "sldSz"
  )
  if (!slideSize) return DEFAULT_PPTX_SLIDE_SIZE

  const widthEmu = Number(slideSize.getAttribute("cx"))
  const heightEmu = Number(slideSize.getAttribute("cy"))
  if (
    !Number.isFinite(widthEmu) ||
    !Number.isFinite(heightEmu) ||
    widthEmu <= 0 ||
    heightEmu <= 0
  ) {
    return DEFAULT_PPTX_SLIDE_SIZE
  }

  return {
    width: Math.round(widthEmu / EMU_PER_PX),
    height: Math.round(heightEmu / EMU_PER_PX),
  }
}
