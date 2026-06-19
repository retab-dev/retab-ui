"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

let dataCellActivationTokenId = 0;

export type DataCellActivationToken = {
  id: string;
  ownsEvent: (event: Event | undefined) => boolean;
  release: () => void;
};

export type DataCellShellActivationRelease = "microtask" | "click-tail";

export type DataCellActivationSource =
  | {
      kind: "pointer";
      token: DataCellActivationToken;
      clientX: number;
      clientY: number;
      detail: number;
      selectionOffset?: number;
    }
  | {
      kind: "keyboard";
      key: string;
    }
  | {
      kind: "shell";
      token: DataCellActivationToken;
      release: DataCellShellActivationRelease;
    };

export type DataCellDismissCause =
  | {
      kind: "outside-pointer";
      event: PointerEvent;
    }
  | {
      kind: "trigger-press";
      event?: Event;
    }
  | {
      kind: "focus-out";
      event?: Event;
    }
  | {
      kind: "cancel-open";
      event?: Event;
    }
  | {
      kind: "escape";
      event: KeyboardEvent;
    }
  | {
      kind: "unknown";
      event?: Event;
    };

export type DataCellOpeningContext = {
  source: DataCellActivationSource | undefined;
  isOpening: () => boolean;
  shouldCancelDismiss: (cause: DataCellDismissCause) => boolean;
  release: () => void;
};

export function createDataCellPointerActivationSource({
  clientX,
  clientY,
  detail,
  event,
}: {
  clientX: number;
  clientY: number;
  detail: number;
  event?: Event;
}): Extract<DataCellActivationSource, { kind: "pointer" }> {
  return {
    kind: "pointer",
    token: createDataCellActivationToken(event, {
      ownUntilReleasedWhenEventMissing: true,
      ownOpeningTailUntilReleasedWhenEventMissing: event === undefined,
    }),
    clientX,
    clientY,
    detail,
  };
}

export function createDataCellKeyboardActivationSource(
  key: string,
): Extract<DataCellActivationSource, { kind: "keyboard" }> {
  return {
    kind: "keyboard",
    key,
  };
}

export function createDataCellShellActivationSource(
  event?: Event,
): Extract<DataCellActivationSource, { kind: "shell" }> {
  return {
    kind: "shell",
    token: createDataCellActivationToken(event, {
      ownUntilReleasedWhenEventMissing: true,
    }),
    release: event?.type === "click" ? "microtask" : "click-tail",
  };
}

export function createDataCellActivationToken(
  openingEvent?: Event,
  {
    ownUntilReleasedWhenEventMissing = false,
    ownOpeningTailUntilReleasedWhenEventMissing = false,
  }: {
    ownUntilReleasedWhenEventMissing?: boolean;
    ownOpeningTailUntilReleasedWhenEventMissing?: boolean;
  } = {},
): DataCellActivationToken {
  const id = `data-cell-activation-${++dataCellActivationTokenId}`;
  let isReleased = false;
  const openingPoint = openingEvent
    ? getDataCellEventPoint(openingEvent)
    : null;

  return {
    id,
    ownsEvent(event) {
      if (isReleased) return false;
      if (!event) return ownUntilReleasedWhenEventMissing;
      if (openingEvent && event === openingEvent) return true;
      if (!openingEvent && ownOpeningTailUntilReleasedWhenEventMissing) {
        return isDataCellOpeningTailEvent(event);
      }
      if (openingPoint && isDataCellOpeningEventTail(event, openingPoint)) {
        return true;
      }
      return false;
    },
    release() {
      isReleased = true;
    },
  };
}

export function useDataCellOpeningContext(
  activationSource: DataCellActivationSource | undefined,
  {
    enabled,
    releaseAfterMicrotask = false,
  }: {
    enabled: boolean;
    releaseAfterMicrotask?: boolean;
  },
): DataCellOpeningContext {
  const openingSourceRef = React.useRef<DataCellActivationSource | undefined>(
    undefined,
  );
  const releaseOpeningRef = React.useRef<(() => void) | null>(null);

  const release = React.useCallback(() => {
    openingSourceRef.current = undefined;
    releaseOpeningRef.current?.();
    releaseOpeningRef.current = null;
  }, []);

  React.useLayoutEffect(() => {
    release();
    if (!enabled || !activationSource || activationSource.kind === "keyboard") {
      return;
    }

    openingSourceRef.current = activationSource;
    releaseOpeningRef.current = holdDataCellActivationThroughOpeningEvent(
      activationSource,
      {
        releaseAfterMicrotask:
          releaseAfterMicrotask ||
          shouldReleaseDataCellOpeningAfterMicrotask(activationSource),
      },
    );
  }, [activationSource, enabled, release, releaseAfterMicrotask]);

  React.useEffect(() => release, [release]);

  return React.useMemo(
    () => ({
      source: activationSource,
      isOpening: () => openingSourceRef.current !== undefined,
      shouldCancelDismiss: (cause) =>
        shouldCancelDataCellOpeningDismiss(openingSourceRef.current, cause),
      release,
    }),
    [activationSource, release],
  );
}

export function useDataCellActivationClickTail() {
  const isArmedRef = React.useRef(false);

  return React.useMemo(
    () => ({
      arm() {
        isArmedRef.current = true;
      },
      consume() {
        if (!isArmedRef.current) return false;
        isArmedRef.current = false;
        return true;
      },
    }),
    [],
  );
}

function holdDataCellActivationThroughOpeningEvent(
  activation: DataCellActivationSource | undefined,
  {
    releaseAfterMicrotask = false,
  }: {
    releaseAfterMicrotask?: boolean;
  } = {},
) {
  if (!activation || activation.kind === "keyboard") return () => {};

  const release = () => activation.token.release();
  const releaseAfterDocumentClick = () => queueMicrotask(release);
  const releaseBeforeNewPointer = (event: PointerEvent) => {
    if (!activation.token.ownsEvent(event)) release();
  };
  if (typeof document !== "undefined") {
    document.addEventListener("pointerdown", releaseBeforeNewPointer);
    document.addEventListener("click", releaseAfterDocumentClick, {
      once: true,
    });
  }
  if (releaseAfterMicrotask) queueMicrotask(release);

  return () => {
    activation.token.release();
    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", releaseBeforeNewPointer);
      document.removeEventListener("click", releaseAfterDocumentClick);
    }
  };
}

function shouldCancelDataCellOpeningDismiss(
  activationSource: DataCellActivationSource | undefined,
  cause: DataCellDismissCause,
) {
  if (!activationSource || activationSource.kind === "keyboard") return false;
  if (!isDataCellOpeningDismissCause(activationSource, cause)) return false;

  return (
    activationSource.token.ownsEvent(cause.event) ||
    (isDataCellEventlessOpeningDismissCause(cause) &&
      activationSource.token.ownsEvent(undefined))
  );
}

function isDataCellOpeningDismissCause(
  activationSource: Exclude<DataCellActivationSource, { kind: "keyboard" }>,
  cause: DataCellDismissCause,
) {
  if (cause.kind === "escape") return false;
  if (activationSource.kind === "shell") return true;
  return (
    cause.kind === "outside-pointer" ||
    cause.kind === "trigger-press" ||
    cause.kind === "focus-out" ||
    cause.kind === "cancel-open"
  );
}

function isDataCellEventlessOpeningDismissCause(cause: DataCellDismissCause) {
  return (
    cause.kind === "trigger-press" ||
    cause.kind === "focus-out" ||
    cause.kind === "cancel-open" ||
    cause.kind === "unknown"
  );
}

function shouldReleaseDataCellOpeningAfterMicrotask(
  activationSource: DataCellActivationSource,
) {
  return (
    activationSource.kind === "shell" &&
    activationSource.release === "microtask"
  );
}

function getDataCellEventPoint(event: Event) {
  if (
    !("clientX" in event) ||
    !("clientY" in event) ||
    typeof event.clientX !== "number" ||
    typeof event.clientY !== "number"
  ) {
    return null;
  }
  return {
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

function isDataCellOpeningEventTail(
  event: Event,
  openingPoint: { clientX: number; clientY: number },
) {
  if (!isDataCellOpeningTailEvent(event)) return false;
  const eventPoint = getDataCellEventPoint(event);
  return (
    eventPoint !== null &&
    eventPoint.clientX === openingPoint.clientX &&
    eventPoint.clientY === openingPoint.clientY
  );
}

function isDataCellOpeningTailEvent(event: Event) {
  return (
    event.type === "click" ||
    event.type === "pointerup" ||
    event.type === "mouseup"
  );
}
