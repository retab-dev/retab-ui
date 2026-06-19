export const LONG_TEXT_SAMPLE_FILE_NAME = "very-long-review-notes.txt";
export const LONG_TEXT_SAMPLE_MIME_TYPE = "text/plain";

const LONG_TEXT_SECTIONS = 900;

const TOPICS = [
  "contracts",
  "support tickets",
  "clinical intake notes",
  "audit workpapers",
  "deposition summaries",
  "research memos",
  "incident reports",
  "property inspections",
] as const;

const LONG_TOKEN =
  "aVeryLongUnbrokenIdentifierDesignedToConfirmThatBreakWordsStillKeepsTextInsideTheViewerColumn";

function buildLongTextSample() {
  const lines = [
    "Very long text viewer stress sample",
    "",
    "This generated document is intentionally large. It mixes short notes, long prose lines, blank lines, and occasional unbroken tokens so the Text Viewer has to virtualize source lines while wrapping text naturally inside the available width.",
    "",
  ];

  for (let index = 1; index <= LONG_TEXT_SECTIONS; index += 1) {
    const topic = TOPICS[(index - 1) % TOPICS.length];
    const section = String(index).padStart(4, "0");
    const cadence =
      index % 9 === 0
        ? "This line is intentionally a little denser than the others so zoom changes and narrow mobile widths produce several wrapped visual rows from a single source line."
        : "This line stays readable but long enough to wrap on common documentation widths, which makes row-height prediction visible while scrolling.";
    const longToken =
      index % 17 === 0 ? ` The next token is unbroken: ${LONG_TOKEN}.` : "";

    lines.push(
      `Section ${section} - ${topic}`,
      `Reviewer note ${section}: The ${topic} sample keeps repeating with small variations so the viewer has a substantial body of text to lay out, scroll, highlight, and download. ${cadence} Source-line ${section} should remain addressable even though the rendered height changes with the viewport.${longToken}`,
      `Follow-up ${section}: Resize the page, zoom the text, and drag the scrollbar through this document. The prose column should keep wrapping naturally while only the visible portion of the document is mounted.`,
      "",
    );
  }

  return lines.join("\n");
}

export const LONG_TEXT_SAMPLE = buildLongTextSample();
