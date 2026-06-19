"use client";

import * as React from "react";

import type { ViewerResource } from "@/lib/viewer-resource";

import { PlainTextViewerFrame } from "./plain-text-viewer-frame";
import { ChenglouTextViewerContent } from "./text-viewer-chenglou-content";
import { TextViewerFallback } from "./text-viewer-chrome";
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types";

export const VanillaChengTextViewer = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function VanillaChengTextViewer(props, ref) {
  return (
    <PlainTextViewerFrame
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={VanillaChengTextViewerContent}
    />
  );
});

function VanillaChengTextViewerContent(
  props: TextViewerProps & {
    resource: ViewerResource;
    retryVersion: number;
    forwardedRef?: React.ForwardedRef<TextViewerHandle>;
  },
) {
  return <ChenglouTextViewerContent {...props} projection="vanillacheng" />;
}
