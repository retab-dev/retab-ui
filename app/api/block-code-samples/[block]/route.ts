import { NextResponse, type NextRequest } from "next/server";

import { getLoadedBlockCodeFiles } from "@/lib/block-code-samples";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ block: string }> },
) {
  const { block } = await params;
  const codeSamples = await getLoadedBlockCodeFiles(block);

  if (!codeSamples) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ codeSamples });
}
