"use client";

import { useRef } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/shared/contexts/auth";
import { useMountEffect } from "@/hooks/useMountEffect";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";

interface EditTemplateThumbnailProps {
  fileId: string;
  filename: string;
  className?: string;
}

interface ThumbnailBlobResult {
  objectUrl: string | null;
  isImage: boolean;
}

export function EditTemplateThumbnail({
  fileId,
  filename,
  className,
}: EditTemplateThumbnailProps) {
  // Keying the inner loader on fileId gives us clean remount semantics: object URL lifecycle
  // is tied to that mount, and useMountEffect revokes it on unmount.
  return (
    <ThumbnailInner
      key={fileId}
      fileId={fileId}
      filename={filename}
      className={className}
    />
  );
}

function ThumbnailInner({
  fileId,
  filename,
  className,
}: EditTemplateThumbnailProps) {
  const { fetchWithAuth } = useAuth();

  const query = useQuery<ThumbnailBlobResult, Error>({
    queryKey: ["edit-template-thumbnail", fileId],
    queryFn: async () => {
      const response = await fetchWithAuth(`/v1/files/${fileId}/thumbnail`, {
        headers: { Accept: "image/png,image/jpeg,*/*" },
      });
      if (!response.ok) {
        throw new Error(`Failed to load thumbnail: ${response.status}`);
      }
      const blob = await response.blob();
      const resolvedMimeType =
        blob.type ||
        response.headers.get("content-type") ||
        "application/octet-stream";
      if (resolvedMimeType.startsWith("image/")) {
        return { objectUrl: URL.createObjectURL(blob), isImage: true };
      }
      return { objectUrl: null, isImage: false };
    },
    staleTime: 5 * 60 * 1000,
  });

  const thumbnailUrl = query.data?.objectUrl ?? null;
  const isImage = query.data?.isImage ?? false;

  // Track the latest URL via a ref so the mount-cleanup revokes the final value (not null from
  // the initial loading render).
  const urlRef = useRef<string | null>(null);
  urlRef.current = thumbnailUrl;

  useMountEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  });

  if (query.isLoading) {
    return <Skeleton className={cn("h-8 w-8 rounded-xs", className)} />;
  }

  if (!thumbnailUrl || !isImage || query.isError) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-xs border",
          className,
        )}
      >
        <FileIcon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{filename}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-muted/30 relative h-8 w-8 overflow-hidden rounded-xs border",
        className,
      )}
    >
      <Image
        src={thumbnailUrl}
        alt={`Preview of ${filename}`}
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
