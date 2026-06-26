export type PageMarkdownProjectionNode = {
  children?: PageMarkdownProjectionNode[];
  properties?: Record<string, unknown>;
  type: string;
  value?: unknown;
};

export type PageMarkdownProjectionWorkerRequest = {
  id: number;
  markdown: string;
  type: "project";
};

export type PageMarkdownProjectionWorkerResponse =
  | {
      id: number;
      ok: true;
      projection: PageMarkdownProjectionNode;
      type: "projected";
    }
  | {
      error: string;
      id: number;
      ok: false;
      type: "projected";
    };
