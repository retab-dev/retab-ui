"use client";

import * as React from "react";

import type {
  DocumentSegment,
  SegmentAnchor,
} from "./segmented-document-model";
import {
  useSegmentedDocumentModel,
  useSegmentedDocumentViewport,
} from "./segmented-document-provider";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type SegmentedItemNavigationOptions = {
  behavior?: ScrollBehavior;
  clearPreview?: boolean;
};

export type SegmentedItemLink = {
  activeAnchor: SegmentAnchor | null;
  activeAnchors: readonly SegmentAnchor[];
  activeItemId: string | null;
  activeSegment: DocumentSegment | null;
  clearPreview: () => void;
  navigateItem: (
    itemId: string,
    options?: SegmentedItemNavigationOptions,
  ) => void;
  previewItem: (itemId: string | null) => void;
  selectItem: (itemId: string | null) => void;
  selectedItemId: string | null;
};

export type SegmentedItemLinkOptions = {
  initialItemId?: string | null;
};

const EMPTY_SEGMENT_ANCHORS: readonly SegmentAnchor[] = [];

export function useSegmentedItemLink(
  options: SegmentedItemLinkOptions = {},
): SegmentedItemLink {
  const model = useSegmentedDocumentModel();
  const viewport = useSegmentedDocumentViewport();
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(
    null,
  );
  const segmentByItemId = React.useMemo(
    () =>
      new Map(
        model.segments.map((segment) => [
          segment.sourceId ?? segment.id,
          segment,
        ]),
      ),
    [model.segments],
  );
  const anchorsBySegmentId = React.useMemo(
    () =>
      (model.anchors ?? []).reduce((anchorsBySegmentId, anchor) => {
        const anchors = anchorsBySegmentId.get(anchor.segmentId);
        if (anchors) {
          anchors.push(anchor);
        } else {
          anchorsBySegmentId.set(anchor.segmentId, [anchor]);
        }
        return anchorsBySegmentId;
      }, new Map<string, SegmentAnchor[]>()),
    [model.anchors],
  );
  const previewSegment =
    model.segments.find(
      (segment) => segment.id === viewport.model.previewSegmentId,
    ) ?? null;
  const selectedSegment = selectedItemId
    ? (segmentByItemId.get(selectedItemId) ?? null)
    : null;
  const activeSegment = previewSegment ?? selectedSegment;
  const activeItemId = activeSegment
    ? (activeSegment.sourceId ?? activeSegment.id)
    : selectedItemId;
  const activeAnchors = activeSegment
    ? (anchorsBySegmentId.get(activeSegment.id) ?? EMPTY_SEGMENT_ANCHORS)
    : EMPTY_SEGMENT_ANCHORS;
  const activeAnchor = activeAnchors[0] ?? null;

  useKeyedMountEffect(joinEffectKey([segmentByItemId, selectedItemId]), () => {
    if (selectedItemId && !segmentByItemId.has(selectedItemId)) {
      setSelectedItemId(null);
    }
  });

  useKeyedMountEffect(
    joinEffectKey([options.initialItemId, segmentByItemId, selectedItemId]),
    () => {
      const initialItemId = options.initialItemId ?? null;
      if (
        !initialItemId ||
        selectedItemId != null ||
        !segmentByItemId.has(initialItemId)
      ) {
        return;
      }
      setSelectedItemId(initialItemId);
    },
  );

  const clearPreview = viewport.interaction.clearPreview;

  const navigateSegment = React.useCallback(
    (segment: DocumentSegment, options?: SegmentedItemNavigationOptions) => {
      const anchor = anchorsBySegmentId.get(segment.id)?.[0];
      if (anchor) {
        viewport.navigation.scrollToAnchor(anchor, options);
        return;
      }
      viewport.navigation.scrollToSegmentStart(segment, options);
    },
    [anchorsBySegmentId, viewport.navigation],
  );

  const navigateItem = React.useCallback(
    (itemId: string, options?: SegmentedItemNavigationOptions) => {
      const segment = segmentByItemId.get(itemId);
      if (!segment) return;

      navigateSegment(segment, options);
    },
    [navigateSegment, segmentByItemId],
  );

  const previewItem = React.useCallback(
    (itemId: string | null) => {
      if (!itemId) {
        viewport.interaction.clearPreview();
        return;
      }

      const segment = segmentByItemId.get(itemId);
      if (!segment) return;

      viewport.interaction.previewSegment(segment.id);
    },
    [segmentByItemId, viewport.interaction],
  );

  const selectItem = React.useCallback(
    (itemId: string | null) => {
      if (!itemId) {
        setSelectedItemId(null);
        return;
      }

      if (!segmentByItemId.has(itemId)) return;

      setSelectedItemId(itemId);
      viewport.interaction.clearPreview();
    },
    [segmentByItemId, viewport.interaction],
  );

  return React.useMemo(
    () => ({
      activeAnchor,
      activeAnchors,
      activeItemId,
      activeSegment,
      clearPreview,
      navigateItem,
      previewItem,
      selectItem,
      selectedItemId,
    }),
    [
      activeAnchor,
      activeAnchors,
      activeItemId,
      activeSegment,
      clearPreview,
      navigateItem,
      previewItem,
      selectItem,
      selectedItemId,
    ],
  );
}
