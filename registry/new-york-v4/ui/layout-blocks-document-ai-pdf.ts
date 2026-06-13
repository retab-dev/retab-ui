import {
  documentAiPageToDataUrl,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai"

type DocumentAiPage = NonNullable<DocumentAiDocument["pages"]>[number]

type PdfImagePage = {
  data: Uint8Array
  width: number
  height: number
}

const PDF_TEXT_ENCODER = new TextEncoder()
const PDF_JPEG_QUALITY = 0.92

export async function documentAiToPdfBlob(
  document: DocumentAiDocument
): Promise<Blob> {
  const pages = document.pages ?? []
  const imagePages = await Promise.all(
    pages.flatMap((page) => {
      const dataUrl = documentAiPageToDataUrl(page)
      return dataUrl ? [documentAiPageToPdfImage(page, dataUrl)] : []
    })
  )

  if (!imagePages.length) {
    throw new Error("Document AI output has no embedded page images.")
  }

  return new Blob([writePdf(imagePages)], { type: "application/pdf" })
}

async function documentAiPageToPdfImage(
  page: DocumentAiPage,
  dataUrl: string
): Promise<PdfImagePage> {
  const image = await loadImage(dataUrl)
  const width =
    positiveNumber(page.dimension?.width ?? page.image?.width) ??
    image.naturalWidth
  const height =
    positiveNumber(page.dimension?.height ?? page.image?.height) ??
    image.naturalHeight
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas 2D context is unavailable.")

  context.fillStyle = "#fff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const jpegDataUrl = canvas.toDataURL("image/jpeg", PDF_JPEG_QUALITY)
  return {
    data: dataUrlToBytes(jpegDataUrl),
    width: canvas.width,
    height: canvas.height,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error("Failed to load Document AI page image."))
    image.src = src
  })
}

function writePdf(pages: PdfImagePage[]) {
  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let position = 0
  let objectNumber = 1

  function write(value: string | Uint8Array) {
    const chunk =
      typeof value === "string" ? PDF_TEXT_ENCODER.encode(value) : value
    chunks.push(chunk)
    position += chunk.length
  }

  function beginObject() {
    offsets[objectNumber] = position
    write(`${objectNumber} 0 obj\n`)
    return objectNumber++
  }

  function endObject() {
    write("endobj\n")
  }

  write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")

  const catalogObject = beginObject()
  write("<< /Type /Catalog /Pages 2 0 R >>\n")
  endObject()

  const pagesObject = beginObject()
  const firstPageObject = 3
  const pageObjectNumbers = pages.map((_, index) => firstPageObject + index * 3)
  write(
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers
      .map((pageObject) => `${pageObject} 0 R`)
      .join(" ")}] >>\n`
  )
  endObject()

  for (const [index, page] of pages.entries()) {
    const pageObject = beginObject()
    const imageObject = pageObject + 1
    const contentObject = pageObject + 2
    write(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Im${index + 1} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\n`
    )
    endObject()

    beginObject()
    write(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`
    )
    write(page.data)
    write("\nendstream\n")
    endObject()

    const content = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im${index + 1} Do\nQ\n`
    beginObject()
    write(`<< /Length ${PDF_TEXT_ENCODER.encode(content).length} >>\nstream\n`)
    write(content)
    write("endstream\n")
    endObject()
  }

  const xrefOffset = position
  write(`xref\n0 ${objectNumber}\n`)
  write("0000000000 65535 f \n")
  for (let index = 1; index < objectNumber; index += 1) {
    write(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`)
  }
  write(
    `trailer\n<< /Size ${objectNumber} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  )

  const bytes = new Uint8Array(position)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1]
  if (!base64) throw new Error("Invalid image data URL.")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function positiveNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined
}
