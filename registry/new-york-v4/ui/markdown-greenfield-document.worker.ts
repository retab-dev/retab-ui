import { createMarkdownGreenfieldDocument } from "./markdown-greenfield-document"

type MarkdownDocumentWorkerRequest = {
  id: number
  text: string
}

type MarkdownDocumentWorkerResponse =
  | {
      type: "ready"
    }
  | {
      document: ReturnType<typeof createMarkdownGreenfieldDocument>
      id: number
      ok: true
      type: "result"
    }
  | {
      id: number
      message: string
      ok: false
      type: "result"
    }

self.postMessage({ type: "ready" } satisfies MarkdownDocumentWorkerResponse)

self.onmessage = (event: MessageEvent<MarkdownDocumentWorkerRequest>) => {
  const { id, text } = event.data
  try {
    const document = createMarkdownGreenfieldDocument(text)
    self.postMessage({
      document,
      id,
      ok: true,
      type: "result",
    } satisfies MarkdownDocumentWorkerResponse)
  } catch (error) {
    self.postMessage({
      id,
      message:
        error instanceof Error ? error.message : "Could not parse Markdown.",
      ok: false,
      type: "result",
    } satisfies MarkdownDocumentWorkerResponse)
  }
}
