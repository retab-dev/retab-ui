import { TextViewerProfileClient } from "./text-viewer-profile-client";

export default async function TextViewerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const params = await searchParams;
  const variant =
    params.variant === "vanillacheng"
      ? "vanillacheng"
      : params.variant === "chenglou"
        ? "chenglou"
        : "current";
  return <TextViewerProfileClient variant={variant} />;
}
