import { type NextRequest } from "next/server";

const POLITAX_ASSET_BASE_URL =
  "https://storage.googleapis.com/retab-public-assets/politaxsplit";
const SAFE_PREFIX_RE = /^[a-z0-9-]+$/;
const SAFE_DOCUMENT_RE = /^[A-Za-z0-9_.-]+\.pdf$/;

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ document: string; prefix: string }> },
) {
  return proxyPolitaxPdf(request, await params);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ document: string; prefix: string }> },
) {
  return proxyPolitaxPdf(request, await params, { method: "HEAD" });
}

async function proxyPolitaxPdf(
  request: NextRequest,
  params: { document: string; prefix: string },
  options: { method?: "GET" | "HEAD" } = {},
) {
  const { document, prefix } = params;
  if (!SAFE_PREFIX_RE.test(prefix) || !SAFE_DOCUMENT_RE.test(document)) {
    return Response.json({ error: "Invalid PDF path." }, { status: 400 });
  }

  const upstreamUrl = `${POLITAX_ASSET_BASE_URL}/pdfs/${encodeURIComponent(prefix)}/${encodeURIComponent(document)}`;
  const range = request.headers.get("range");
  const upstream = await fetch(upstreamUrl, {
    headers: range ? { range } : undefined,
    method: options.method ?? "GET",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return Response.json(
      { error: `Failed to load PDF: ${upstream.status}` },
      { status: upstream.status },
    );
  }

  const headers = proxiedPdfHeaders(upstream.headers);
  return new Response(options.method === "HEAD" ? null : upstream.body, {
    headers,
    status: upstream.status,
  });
}

function proxiedPdfHeaders(upstreamHeaders: Headers) {
  const headers = new Headers();
  for (const name of [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = upstreamHeaders.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-disposition", "inline");
  return headers;
}
