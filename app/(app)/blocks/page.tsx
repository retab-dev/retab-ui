import { redirect } from "next/navigation";

import { DEFAULT_VIEWER_BLOCK_TAB_ID } from "@/lib/viewer-blocks";

export const dynamic = "force-static";
export const revalidate = false;

export default function BlocksPage() {
  redirect(`/blocks/${DEFAULT_VIEWER_BLOCK_TAB_ID}`);
}
