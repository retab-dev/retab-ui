import { describe, expect, test } from "bun:test";

import type { Edit } from "@/types";

import {
  dataUrlToArrayBuffer,
  getEditHistoryFilledDocument,
  getEditHistoryFormData,
  getEditHistoryInstructions,
  getEditHistoryModel,
} from "./history-hydration";

describe("edit history hydration", () => {
  test("loads filled documents from canonical edit result MIME data", async () => {
    const edit = {
      id: "edt_123",
      file: {
        id: "file_original",
        filename: "source.pdf",
        mime_type: "application/pdf",
      },
      model: "retab-large",
      instructions: "fill the form",
      config: { color: "#000080" },
      status: "completed",
      output: {
        form_data: [
          {
            key: "name",
            description: "Name",
            type: "text",
            value: "Ada",
            bbox: { left: 0, top: 0, width: 1, height: 1, page: 1 },
          },
        ],
        filled_document: {
          filename: "filled.pdf",
          url: "data:application/pdf;base64,SGVsbG8=",
        },
      },
    } as unknown as Edit;

    const filledDocument = getEditHistoryFilledDocument(edit);

    expect(getEditHistoryModel(edit)).toBe("retab-large");
    expect(getEditHistoryInstructions(edit)).toBe("fill the form");
    expect(getEditHistoryFormData(edit)).toHaveLength(1);
    expect(filledDocument?.filename).toBe("filled.pdf");
    expect(
      new TextDecoder().decode(
        dataUrlToArrayBuffer(filledDocument?.url ?? "")!,
      ),
    ).toBe("Hello");
  });

  test("loads template edit result data from canonical history payloads", () => {
    const templateEdit = {
      id: "edt_template_123",
      template_id: "tmpl_123",
      file: {
        id: "file_template",
        filename: "template.pdf",
        mime_type: "application/pdf",
      },
      model: "retab-small",
      instructions: "fill from parsed invoice",
      config: { color: "#000080" },
      status: "completed",
      output: {
        form_data: [
          {
            key: "invoice_number",
            description: "Invoice number",
            type: "text",
            value: "INV-001",
            bbox: { left: 0, top: 0, width: 1, height: 1, page: 1 },
          },
        ],
        filled_document: {
          filename: "template-filled.pdf",
          url: "data:application/pdf;base64,VGVtcGxhdGU=",
        },
      },
    } as unknown as Edit;

    const filledDocument = getEditHistoryFilledDocument(templateEdit);

    expect(templateEdit.template_id).toBe("tmpl_123");
    expect(getEditHistoryModel(templateEdit)).toBe("retab-small");
    expect(getEditHistoryInstructions(templateEdit)).toBe(
      "fill from parsed invoice",
    );
    expect(getEditHistoryFormData(templateEdit)[0]?.key).toBe("invoice_number");
    expect(filledDocument?.filename).toBe("template-filled.pdf");
    expect(
      new TextDecoder().decode(
        dataUrlToArrayBuffer(filledDocument?.url ?? "")!,
      ),
    ).toBe("Template");
  });
});
