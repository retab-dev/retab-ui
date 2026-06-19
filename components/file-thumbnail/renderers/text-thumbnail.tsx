"use client";

import * as React from "react";

import type { ViewerResource } from "@/lib/viewer-resource";
import { useThumbnailResource } from "@/components/file-thumbnail/thumbnail-resource";
import {
  getThumbnailText,
  thumbnailFileMeta,
} from "@/components/file-thumbnail/thumbnail-text";

const TEXT_THUMBNAIL_MAX_PARAGRAPHS = 12;
const TEXT_THUMBNAIL_FONT_SIZE = 7;
const TEXT_THUMBNAIL_LINE_HEIGHT = 1.55;

export function TextThumbnail({
  resource,
  thumbnailKey,
}: {
  resource: ViewerResource;
  thumbnailKey: string;
}) {
  const raw = useThumbnailResource(
    getThumbnailText(
      thumbnailFileMeta(resource),
      resource.content,
      thumbnailKey,
    ),
  );
  const paragraphs = React.useMemo(() => proseThumbnailParagraphs(raw), [raw]);

  if (!paragraphs.length) return <EmptyTextThumbnail />;

  return (
    <div
      data-slot="text-thumbnail"
      className="bg-card text-foreground/80 absolute inset-0 overflow-hidden p-3 font-sans"
      style={{
        fontSize: TEXT_THUMBNAIL_FONT_SIZE,
        lineHeight: TEXT_THUMBNAIL_LINE_HEIGHT,
      }}
    >
      <div className="space-y-1.5">
        {paragraphs.map((paragraph, i) => (
          <p key={i} className="text-pretty break-words">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}

function EmptyTextThumbnail() {
  return (
    <div
      aria-label="Empty text file"
      data-slot="text-thumbnail-empty"
      className="bg-card absolute inset-0"
    />
  );
}

function proseThumbnailParagraphs(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .slice(0, TEXT_THUMBNAIL_MAX_PARAGRAPHS);
}
