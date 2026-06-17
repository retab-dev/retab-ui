"use client"

import * as React from "react"

import {
  EmailViewer,
  type EmailViewerMessage,
} from "@/components/ui/email-viewer"

const INLINE_LOGO_CONTENT_ID = "retab-logo@fake-email.local"

const INLINE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96" role="img" aria-label="Retab">
  <rect width="320" height="96" rx="18" fill="#111827"/>
  <circle cx="50" cy="48" r="24" fill="#f97316"/>
  <path d="M43 37h18c8 0 13 4 13 11 0 5-3 9-8 10l10 15H62L53 60h-9v13H32V37h11Zm1 10v4h15c2 0 4-1 4-3s-2-3-4-3H44Z" fill="white"/>
  <text x="96" y="56" fill="white" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700">Retab</text>
  <text x="96" y="75" fill="#d1d5db" font-family="Inter, Arial, sans-serif" font-size="13">sample inbound email</text>
</svg>`

const BODY_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 28px;
        color: #111827;
        font-family: Inter, Arial, sans-serif;
        line-height: 1.5;
      }
      .wrap {
        max-width: 720px;
        margin: 0 auto;
      }
      img.logo {
        display: block;
        width: 220px;
        height: auto;
        margin-bottom: 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
        line-height: 1.2;
      }
      p {
        margin: 0 0 14px;
      }
      table {
        width: 100%;
        margin-top: 18px;
        border-collapse: collapse;
        font-size: 14px;
      }
      th,
      td {
        border-bottom: 1px solid #e5e7eb;
        padding: 10px 8px;
        text-align: left;
      }
      th {
        color: #6b7280;
        font-weight: 600;
      }
      .callout {
        margin: 18px 0;
        padding: 12px 14px;
        border-left: 4px solid #f97316;
        background: #fff7ed;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <img class="logo" src="cid:<${INLINE_LOGO_CONTENT_ID}>" alt="Retab logo" />
      <h1>Contract packet ready for review</h1>
      <p>Hi Avery,</p>
      <p>The vendor packet for <strong>Northstar Foods</strong> is attached. The inline logo above is loaded from a Content-ID attachment, while the supporting files are regular attachments in the sidebar.</p>
      <div class="callout">Please review the prospectus first, then compare the line-item CSV against the workbook totals.</div>
      <table>
        <thead>
          <tr><th>File</th><th>Purpose</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr><td>spacex-prospectus.pdf</td><td>PDF preview path</td><td>Needs signature</td></tr>
          <tr><td>sales.csv</td><td>CSV grid path</td><td>Ready</td></tr>
          <tr><td>nvidia-financials-fy2024.xlsx</td><td>XLSX workbook path</td><td>Ready</td></tr>
          <tr><td>review-note.html</td><td>HTML attachment path</td><td>FYI</td></tr>
        </tbody>
      </table>
      <p>Thanks,<br />Mina</p>
    </main>
  </body>
</html>`

const TEXT_FALLBACK = `Contract packet ready for review

Hi Avery,

The vendor packet for Northstar Foods is attached. The HTML version includes an inline CID logo, and the supporting files are regular attachments.

Attachments:
- spacex-prospectus.pdf
- sales.csv
- nvidia-financials-fy2024.xlsx
- review-note.html

Thanks,
Mina`

const REVIEW_NOTE_HTML = `<!doctype html>
<html>
  <body style="font-family: Inter, Arial, sans-serif; padding: 24px; line-height: 1.5;">
    <h1>Review note</h1>
    <p>This standalone HTML attachment proves non-inline HTML opens independently from the email body.</p>
    <ul>
      <li>Confirm signature block.</li>
      <li>Check CSV totals against workbook totals.</li>
      <li>Archive the original PDF after approval.</li>
    </ul>
  </body>
</html>`

export function createFakeEmailMessage(): EmailViewerMessage {
  return {
    id: "fake-email-contract-packet",
    subject: "Northstar Foods contract packet",
    from: "Mina Patel <mina@retab.example>",
    to: ["Avery Lee <avery@retab.example>", "Ops Review <ops@retab.example>"],
    sentAt: "2026-06-13T09:42:00-04:00",
    root: {
      id: "root",
      mimeType: "multipart/mixed",
      children: [
        {
          id: "alternative",
          mimeType: "multipart/alternative",
          children: [
            {
              id: "text-body",
              mimeType: "text/plain",
              source: {
                kind: "text",
                text: TEXT_FALLBACK,
                fileName: "message.txt",
                mimeType: "text/plain",
                identityKey: "fake-email:text-body",
              },
              size: TEXT_FALLBACK.length,
            },
            {
              id: "related",
              mimeType: "multipart/related",
              children: [
                {
                  id: "html-body",
                  mimeType: "text/html",
                  source: {
                    kind: "text",
                    text: BODY_HTML,
                    fileName: "message.html",
                    mimeType: "text/html",
                    identityKey: "fake-email:html-body",
                  },
                  size: BODY_HTML.length,
                },
                {
                  id: "inline-retab-logo",
                  mimeType: "image/svg+xml",
                  contentId: `<${INLINE_LOGO_CONTENT_ID}>`,
                  disposition: "inline",
                  fileName: "retab-logo.svg",
                  source: {
                    kind: "text",
                    text: INLINE_LOGO_SVG,
                    fileName: "retab-logo.svg",
                    mimeType: "image/svg+xml",
                    identityKey: "fake-email:inline-logo",
                  },
                  size: INLINE_LOGO_SVG.length,
                },
              ],
            },
          ],
        },
        {
          id: "prospectus",
          mimeType: "application/pdf",
          disposition: "attachment",
          fileName: "spacex-prospectus.pdf",
          source: {
            kind: "url",
            url: "/samples/spacex-prospectus.pdf",
            fileName: "spacex-prospectus.pdf",
            mimeType: "application/pdf",
          },
          size: 1_220_000,
        },
        {
          id: "sales-csv",
          mimeType: "text/csv",
          disposition: "attachment",
          fileName: "sales.csv",
          source: {
            kind: "url",
            url: "/samples/sales.csv",
            fileName: "sales.csv",
            mimeType: "text/csv",
          },
          size: 18_432,
        },
        {
          id: "financials-xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment",
          fileName: "nvidia-financials-fy2024.xlsx",
          source: {
            kind: "url",
            url: "/samples/nvidia-financials-fy2024.xlsx",
            fileName: "nvidia-financials-fy2024.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
          size: 148_900,
        },
        {
          id: "review-note",
          mimeType: "text/html",
          disposition: "attachment",
          fileName: "review-note.html",
          source: {
            kind: "text",
            text: REVIEW_NOTE_HTML,
            fileName: "review-note.html",
            mimeType: "text/html",
            identityKey: "fake-email:review-note-html",
          },
          size: REVIEW_NOTE_HTML.length,
        },
      ],
    },
  }
}

export function EmailViewerDemo() {
  const message = React.useMemo(() => createFakeEmailMessage(), [])

  return (
    <div className="h-[720px] min-h-0">
      <EmailViewer message={message} mode="inline" className="h-full" />
    </div>
  )
}
