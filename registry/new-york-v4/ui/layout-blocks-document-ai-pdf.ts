import {
  documentAiPageImages,
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "./layout-blocks-document-ai";
import { layoutDocumentToPdfBlob } from "./layout-blocks-pdf";

export async function documentAiToPdfBlob(
  document: DocumentAiDocument,
): Promise<Blob> {
  return layoutDocumentToPdfBlob(
    documentAiToLayoutDocument(document),
    documentAiPageImages(document),
  );
}
