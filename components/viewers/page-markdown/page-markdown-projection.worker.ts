import { createPageMarkdownProjectionTree } from "@/components/viewers/page-markdown/page-markdown-projection-parser";
import {
  type PageMarkdownProjectionWorkerRequest,
  type PageMarkdownProjectionWorkerResponse,
} from "@/components/viewers/page-markdown/page-markdown-projection-protocol";

const workerSelf = self as unknown as {
  onmessage:
    | ((event: MessageEvent<PageMarkdownProjectionWorkerRequest>) => void)
    | null;
  postMessage(message: PageMarkdownProjectionWorkerResponse): void;
};

workerSelf.onmessage = (
  event: MessageEvent<PageMarkdownProjectionWorkerRequest>,
) => {
  const request = event.data;
  if (request.type !== "project") {
    postProjectionError(request.id, "Page Markdown worker request is invalid.");
    return;
  }

  try {
    workerSelf.postMessage({
      id: request.id,
      ok: true,
      projection: createPageMarkdownProjectionTree(request.markdown),
      type: "projected",
    });
  } catch (error) {
    postProjectionError(
      request.id,
      error instanceof Error ? error.message : String(error),
    );
  }
};

function postProjectionError(id: number, error: string) {
  workerSelf.postMessage({
    error,
    id,
    ok: false,
    type: "projected",
  });
}
