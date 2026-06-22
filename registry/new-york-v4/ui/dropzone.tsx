"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import {
  formatDropzoneAccept,
  parseDropzoneAccept,
  validateDropzoneFiles,
  type DropzoneAcceptRule,
  type DropzoneFileRejection,
  type DropzoneIntake,
} from "@/components/ui/dropzone-core";

export {
  formatDropzoneAccept,
  matchesDropzoneAccept,
  parseDropzoneAccept,
  validateDropzoneFile,
  validateDropzoneFiles,
  type DropzoneAcceptRule,
  type DropzoneFileRejection,
  type DropzoneIntake,
} from "@/components/ui/dropzone-core";

export type DropzoneFileItem = {
  id: string;
  file: File;
};

type MaybePromise<T> = T | Promise<T>;

export type DropzoneFilesValidatorContext = {
  acceptedFiles: File[];
  currentCount: number;
  currentFiles: DropzoneFileItem[];
  fileRejections: DropzoneFileRejection[];
};

export type DropzoneFilesValidatorResult =
  | DropzoneFileRejection[]
  | DropzoneIntake
  | null
  | undefined
  | void;

export type DropzoneIntakeSource = "drop" | "input" | (string & {});

export type DropzoneIntakeDetails = {
  source: DropzoneIntakeSource;
};

export type DropzoneOpenFileDialogOptions = {
  source?: DropzoneIntakeSource;
};

type DropzoneDataAttributes = {
  [key: `data-${string}`]: string | undefined;
};

type DropzoneRootGetterProps<T extends HTMLElement> = React.HTMLAttributes<T> &
  Partial<DropzoneDataAttributes>;

type DropzoneInputGetterProps = React.ComponentPropsWithRef<"input"> &
  Partial<DropzoneDataAttributes>;

type DropzoneTriggerGetterProps<T extends HTMLElement> =
  React.HTMLAttributes<T> &
    Partial<DropzoneDataAttributes> & {
      /** The trigger is a real `<button>`; suppress the ARIA-button polyfill. */
      native?: boolean;
      source?: DropzoneIntakeSource;
    };

export type UseDropzoneProps = {
  accept?: string | DropzoneAcceptRule[];
  inputAccept?: string | DropzoneAcceptRule[];
  currentFileCount?: number;
  disabled?: boolean;
  dragScope?: "root" | "document";
  files?: DropzoneFileItem[];
  defaultFiles?: DropzoneFileItem[];
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  onFilesChange?: (files: DropzoneFileItem[]) => void;
  onIntake?: (intake: DropzoneIntake, details: DropzoneIntakeDetails) => void;
  storeFiles?: boolean;
  validateFiles?: (
    files: File[],
    context: DropzoneFilesValidatorContext,
  ) => MaybePromise<DropzoneFilesValidatorResult>;
};

export type UseDropzoneReturn = {
  files: DropzoneFileItem[];
  lastIntake: DropzoneIntake;
  lastIntakeDetails: DropzoneIntakeDetails | null;
  isDragging: boolean;
  isDisabled: boolean;
  isValidating: boolean;
  clearFiles: () => void;
  openFileDialog: (options?: DropzoneOpenFileDialogOptions) => void;
  removeFile: (fileId: string) => void;
  reset: () => void;
  resetIntake: () => void;
  getRootProps: <T extends HTMLElement>(
    props?: DropzoneRootGetterProps<T>,
  ) => DropzoneRootGetterProps<T>;
  getInputProps: (props?: DropzoneInputGetterProps) => DropzoneInputGetterProps;
  getTriggerProps: <T extends HTMLElement>(
    props?: DropzoneTriggerGetterProps<T>,
  ) => DropzoneTriggerGetterProps<T>;
};

type DropzoneContextValue = UseDropzoneReturn;

const DropzoneContext = React.createContext<DropzoneContextValue | null>(null);

export type DropzoneProviderProps = UseDropzoneProps & {
  children: React.ReactNode;
};

export function DropzoneProvider({
  children,
  ...dropzoneProps
}: DropzoneProviderProps) {
  const dropzone = useDropzone(dropzoneProps);

  return (
    <DropzoneContext.Provider value={dropzone}>
      {children}
    </DropzoneContext.Provider>
  );
}

export function useDropzoneContext(
  consumerName = "useDropzoneContext",
): DropzoneContextValue {
  const dropzone = React.useContext(DropzoneContext);
  if (!dropzone) {
    throw new Error(`${consumerName} must be used within DropzoneProvider.`);
  }
  return dropzone;
}

export type DropzoneStateProps = {
  children: (dropzone: DropzoneContextValue) => React.ReactNode;
};

export function DropzoneState({ children }: DropzoneStateProps) {
  const dropzone = useDropzoneContext("DropzoneState");
  return <>{children(dropzone)}</>;
}

export type DropzoneRootProps = React.HTMLAttributes<HTMLElement> &
  Partial<DropzoneDataAttributes> & {
    asChild?: boolean;
  };

export const DropzoneRoot = React.forwardRef<HTMLElement, DropzoneRootProps>(
  function DropzoneRoot({ asChild = false, ...props }, ref) {
    const dropzone = useDropzoneContext("DropzoneRoot");
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        {...dropzone.getRootProps(props)}
        ref={ref as React.Ref<HTMLDivElement>}
      />
    );
  },
);

export type DropzoneInputProps = React.ComponentPropsWithoutRef<"input"> &
  Partial<DropzoneDataAttributes>;

export const DropzoneInput = React.forwardRef<
  HTMLInputElement,
  DropzoneInputProps
>(function DropzoneInput(props, ref) {
  const dropzone = useDropzoneContext("DropzoneInput");

  return <input {...dropzone.getInputProps({ ...props, ref })} />;
});

export type DropzoneTriggerProps = React.ComponentPropsWithoutRef<"button"> &
  Partial<DropzoneDataAttributes> & {
    asChild?: boolean;
    native?: boolean;
    source?: DropzoneIntakeSource;
  };

export const DropzoneTrigger = React.forwardRef<
  HTMLElement,
  DropzoneTriggerProps
>(function DropzoneTrigger({ asChild = false, native, ...props }, ref) {
  const dropzone = useDropzoneContext("DropzoneTrigger");
  const Comp = asChild ? Slot : "button";
  const triggerProps = dropzone.getTriggerProps({
    ...props,
    native: native ?? !asChild,
  });

  return <Comp {...triggerProps} ref={ref as React.Ref<HTMLButtonElement>} />;
});

const EMPTY_INTAKE: DropzoneIntake = {
  acceptedFiles: [],
  fileRejections: [],
};
const EMPTY_FILE_ITEMS: DropzoneFileItem[] = [];

export function useDropzone({
  accept,
  inputAccept: nativeInputAccept,
  currentFileCount,
  defaultFiles = [],
  disabled = false,
  dragScope = "root",
  files,
  maxFiles,
  maxSize,
  multiple = true,
  onFilesChange,
  onIntake,
  storeFiles = true,
  validateFiles,
}: UseDropzoneProps = {}): UseDropzoneReturn {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const activeDialogSourceRef = React.useRef<DropzoneIntakeSource | undefined>(
    undefined,
  );
  const dragDepthRef = React.useRef(0);
  const intakeRequestRef = React.useRef(0);
  const isDisabledRef = React.useRef(disabled);
  const shouldStoreFiles = storeFiles;
  const isControlled = shouldStoreFiles && files !== undefined;
  const acceptRules = React.useMemo<DropzoneAcceptRule[]>(
    () => (Array.isArray(accept) ? accept : parseDropzoneAccept(accept)),
    [accept],
  );
  const inputAccept = React.useMemo(
    () => formatDropzoneAccept(nativeInputAccept ?? accept),
    [accept, nativeInputAccept],
  );
  const [uncontrolledItems, setUncontrolledItems] =
    React.useState<DropzoneFileItem[]>(defaultFiles);
  const [lastIntake, setLastIntake] =
    React.useState<DropzoneIntake>(EMPTY_INTAKE);
  const [lastIntakeDetails, setLastIntakeDetails] =
    React.useState<DropzoneIntakeDetails | null>(null);
  const [rawIsDragging, setIsDragging] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const currentItems = shouldStoreFiles
    ? (files ?? uncontrolledItems)
    : EMPTY_FILE_ITEMS;
  const isDragging = disabled ? false : rawIsDragging;

  // itemsRef.current is the latest committed items. The effect mirrors the
  // source of truth into it after every render; internal commits update it
  // eagerly so consecutive same-tick intakes — and the pre-validation count in
  // commitFiles — read the value they just produced. A controlled parent owns
  // the truth: the eager write is optimistic and the effect reconciles it on
  // the parent's next render.
  const itemsRef = React.useRef(currentItems);
  itemsRef.current = currentItems;
  isDisabledRef.current = disabled;

  const invalidatePendingIntake = React.useCallback(
    (clearValidationState = true) => {
      intakeRequestRef.current += 1;
      activeDialogSourceRef.current = undefined;
      if (clearValidationState) setIsValidating(false);
    },
    [],
  );

  const commitFileTransition = React.useCallback(
    (transition: (items: DropzoneFileItem[]) => DropzoneFileItem[]) => {
      if (!shouldStoreFiles) return;
      const nextItems = transition(itemsRef.current);
      itemsRef.current = nextItems;
      if (!isControlled) setUncontrolledItems(nextItems);
      onFilesChange?.(nextItems);
    },
    [isControlled, onFilesChange, shouldStoreFiles],
  );

  const resetDragState = React.useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  }, []);

  const resetIntake = React.useCallback(() => {
    setLastIntake(EMPTY_INTAKE);
    setLastIntakeDetails(null);
  }, []);

  const clearFiles = React.useCallback(() => {
    if (disabled || !shouldStoreFiles) return;
    commitFileTransition(() => []);
  }, [commitFileTransition, disabled, shouldStoreFiles]);

  const reset = React.useCallback(() => {
    if (disabled) return;
    resetDragState();
    resetIntake();
    if (shouldStoreFiles) commitFileTransition(() => []);
  }, [
    commitFileTransition,
    disabled,
    resetDragState,
    resetIntake,
    shouldStoreFiles,
  ]);

  const removeFile = React.useCallback(
    (fileId: string) => {
      if (disabled || !shouldStoreFiles) return;
      commitFileTransition((previousItems) =>
        previousItems.filter((item) => item.id !== fileId),
      );
    },
    [commitFileTransition, disabled, shouldStoreFiles],
  );

  const commitFiles = React.useCallback(
    async (nextFiles: FileList | File[], details: DropzoneIntakeDetails) => {
      if (disabled) return;

      const requestId = intakeRequestRef.current + 1;
      intakeRequestRef.current = requestId;
      const incomingFiles = Array.from(nextFiles);
      const baseItems = multiple ? itemsRef.current : [];
      const effectiveCurrentCount = currentFileCount ?? baseItems.length;
      const effectiveMaxFiles = multiple
        ? maxFiles
        : Math.min(maxFiles ?? 1, 1);
      const intake = validateDropzoneFiles(incomingFiles, {
        accept: acceptRules,
        maxSize,
      });
      let validatedIntake = intake;
      if (validateFiles) {
        setIsValidating(true);
        try {
          validatedIntake = await resolveDropzoneValidation({
            currentCount: effectiveCurrentCount,
            currentFiles: baseItems,
            intake,
            validateFiles,
          });
        } catch (error) {
          validatedIntake = rejectAcceptedFilesForValidationError(
            intake,
            error,
          );
        } finally {
          if (intakeRequestRef.current === requestId) {
            setIsValidating(false);
          }
        }
      }

      if (intakeRequestRef.current !== requestId || isDisabledRef.current) {
        return;
      }

      const finalIntake = applyDropzoneMaxFiles(validatedIntake, {
        currentCount: effectiveCurrentCount,
        maxFiles: effectiveMaxFiles,
      });
      setLastIntake(finalIntake);
      setLastIntakeDetails(details);
      onIntake?.(finalIntake, details);
      if (!shouldStoreFiles || finalIntake.acceptedFiles.length === 0) {
        return;
      }

      const acceptedItems = finalIntake.acceptedFiles.map((file) => ({
        id: createDropzoneFileId(file),
        file,
      }));
      commitFileTransition((previousItems) =>
        createNextDropzoneItems({
          acceptedItems,
          multiple,
          previousItems,
        }),
      );
    },
    [
      acceptRules,
      commitFileTransition,
      currentFileCount,
      disabled,
      maxFiles,
      maxSize,
      multiple,
      onIntake,
      shouldStoreFiles,
      validateFiles,
    ],
  );
  const commitFilesRef = React.useRef(commitFiles);
  commitFilesRef.current = commitFiles;

  const openFileDialog = React.useCallback(
    (options: DropzoneOpenFileDialogOptions = {}) => {
      if (disabled || !inputRef.current) return;
      activeDialogSourceRef.current = options.source;
      inputRef.current.click();
    },
    [disabled],
  );

  useKeyedMountEffect("dropzone-lifecycle", () => {
    return () => {
      invalidatePendingIntake(false);
    };
  });

  useKeyedMountEffect(disabled ? "disabled" : null, () => {
    if (disabled) {
      invalidatePendingIntake();
      resetDragState();
    }
  });

  useKeyedMountEffect(
    dragScope === "document" && !disabled ? "document-drag-listeners" : null,
    () => {
      // Document-level drag listeners are imperative browser wiring for overlays outside the root.
      const handleDocumentDragEnter = (event: DragEvent) => {
        if (!hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragging(true);
      };
      const handleDocumentDragLeave = (event: DragEvent) => {
        if (!hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragging(false);
      };
      const handleDocumentDragOver = (event: DragEvent) => {
        if (!hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer!.dropEffect = "copy";
      };
      const handleDocumentDrop = (event: DragEvent) => {
        if (!hasDraggedFiles(event.dataTransfer)) {
          resetDragState();
          return;
        }
        event.preventDefault();
        resetDragState();
        if (event.dataTransfer?.files.length) {
          void commitFilesRef.current(event.dataTransfer.files, {
            source: "drop",
          });
        }
      };
      const handleDocumentDragEnd = () => {
        resetDragState();
      };

      document.addEventListener("dragenter", handleDocumentDragEnter, true);
      document.addEventListener("dragleave", handleDocumentDragLeave, true);
      document.addEventListener("dragover", handleDocumentDragOver, true);
      document.addEventListener("drop", handleDocumentDrop, true);
      document.addEventListener("dragend", handleDocumentDragEnd, true);

      return () => {
        document.removeEventListener(
          "dragenter",
          handleDocumentDragEnter,
          true,
        );
        document.removeEventListener(
          "dragleave",
          handleDocumentDragLeave,
          true,
        );
        document.removeEventListener("dragover", handleDocumentDragOver, true);
        document.removeEventListener("drop", handleDocumentDrop, true);
        document.removeEventListener("dragend", handleDocumentDragEnd, true);
      };
    },
  );

  const getRootProps = React.useCallback(
    <T extends HTMLElement>(
      props: DropzoneRootGetterProps<T> = {},
    ): DropzoneRootGetterProps<T> => ({
      ...props,
      "aria-disabled": disabled || props["aria-disabled"] || undefined,
      "data-dragging": isDragging ? "" : undefined,
      "data-slot": props["data-slot"] ?? "dropzone",
      onDragEnter: composeEventHandlers(props.onDragEnter, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        if (dragScope === "root") {
          dragDepthRef.current += 1;
          setIsDragging(true);
        }
      }),
      onDragLeave: composeEventHandlers(props.onDragLeave, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        if (dragScope === "root") {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsDragging(false);
        }
      }),
      onDragOver: composeEventHandlers(props.onDragOver, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }),
      onDrop: composeEventHandlers(props.onDrop, (event) => {
        if (disabled || !hasDraggedFiles(event.dataTransfer)) return;
        event.preventDefault();
        resetDragState();
        if (event.dataTransfer.files.length > 0) {
          void commitFiles(event.dataTransfer.files, { source: "drop" });
        }
      }),
    }),
    [commitFiles, disabled, dragScope, isDragging, resetDragState],
  );

  const getInputProps = React.useCallback(
    (props: DropzoneInputGetterProps = {}): DropzoneInputGetterProps => ({
      ...props,
      accept: inputAccept,
      disabled,
      multiple,
      ref: composeRefs(inputRef, props.ref),
      type: "file",
      "data-slot": props["data-slot"] ?? "dropzone-input",
      onChange: composeEventHandlers(props.onChange, (event) => {
        if (disabled) return;
        if (event.currentTarget.files) {
          const source = activeDialogSourceRef.current ?? "input";
          activeDialogSourceRef.current = undefined;
          void commitFiles(event.currentTarget.files, { source });
          event.currentTarget.value = "";
        }
      }),
    }),
    [commitFiles, disabled, inputAccept, multiple],
  );

  const getTriggerProps = React.useCallback(
    <T extends HTMLElement>({
      native = false,
      source,
      ...props
    }: DropzoneTriggerGetterProps<T> = {}): DropzoneTriggerGetterProps<T> => ({
      ...props,
      "data-slot": props["data-slot"] ?? "dropzone-trigger",
      onClick: composeEventHandlers(props.onClick, () => {
        openFileDialog({ source });
      }),
      ...(native
        ? // Native button: the platform owns role, focus, and keyboard
          // activation; only the disabled attribute and button type are ours.
          { disabled, type: "button" as const }
        : // Anything else: polyfill button semantics onto the element.
          {
            role: props.role ?? "button",
            tabIndex: disabled ? -1 : (props.tabIndex ?? 0),
            "aria-disabled": disabled || props["aria-disabled"] || undefined,
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openFileDialog({ source });
              }
            }),
          }),
    }),
    [disabled, openFileDialog],
  );

  return React.useMemo(
    () => ({
      files: currentItems,
      lastIntake,
      lastIntakeDetails,
      isDragging,
      isDisabled: disabled,
      isValidating,
      clearFiles,
      openFileDialog,
      removeFile,
      reset,
      resetIntake,
      getRootProps,
      getInputProps,
      getTriggerProps,
    }),
    [
      clearFiles,
      currentItems,
      disabled,
      getInputProps,
      getRootProps,
      getTriggerProps,
      isDragging,
      isValidating,
      lastIntake,
      lastIntakeDetails,
      openFileDialog,
      removeFile,
      reset,
      resetIntake,
    ],
  );
}

async function resolveDropzoneValidation({
  currentCount,
  currentFiles,
  intake,
  validateFiles,
}: {
  currentCount: number;
  currentFiles: DropzoneFileItem[];
  intake: DropzoneIntake;
  validateFiles: NonNullable<UseDropzoneProps["validateFiles"]>;
}): Promise<DropzoneIntake> {
  if (intake.acceptedFiles.length === 0) return intake;

  const result = await validateFiles(intake.acceptedFiles, {
    acceptedFiles: intake.acceptedFiles,
    currentCount,
    currentFiles,
    fileRejections: intake.fileRejections,
  });
  if (!result) return intake;

  if (Array.isArray(result)) {
    return appendDropzoneRejections(intake, result);
  }

  return {
    acceptedFiles: result.acceptedFiles,
    fileRejections: [...intake.fileRejections, ...result.fileRejections],
  };
}

function applyDropzoneMaxFiles(
  intake: DropzoneIntake,
  {
    currentCount,
    maxFiles,
  }: {
    currentCount: number;
    maxFiles: number | undefined;
  },
): DropzoneIntake {
  if (maxFiles === undefined) return intake;

  const availableSlots = Math.max(0, maxFiles - currentCount);
  if (intake.acceptedFiles.length <= availableSlots) return intake;

  const acceptedFiles = intake.acceptedFiles.slice(0, availableSlots);
  const fileRejections = [
    ...intake.fileRejections,
    ...intake.acceptedFiles.slice(availableSlots).map((file) => ({
      file,
      reason: "too-many-files" as const,
      maxFiles,
    })),
  ];

  return { acceptedFiles, fileRejections };
}

function appendDropzoneRejections(
  intake: DropzoneIntake,
  rejections: DropzoneFileRejection[],
): DropzoneIntake {
  if (rejections.length === 0) return intake;
  const rejectedFiles = new Set(rejections.map((rejection) => rejection.file));

  return {
    acceptedFiles: intake.acceptedFiles.filter(
      (file) => !rejectedFiles.has(file),
    ),
    fileRejections: [...intake.fileRejections, ...rejections],
  };
}

function rejectAcceptedFilesForValidationError(
  intake: DropzoneIntake,
  error: unknown,
): DropzoneIntake {
  return {
    acceptedFiles: [],
    fileRejections: [
      ...intake.fileRejections,
      ...intake.acceptedFiles.map((file) => ({
        file,
        reason: "custom" as const,
        code: "validation-error",
        details:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : error,
      })),
    ],
  };
}

function createNextDropzoneItems({
  acceptedItems,
  multiple,
  previousItems,
}: {
  acceptedItems: DropzoneFileItem[];
  multiple: boolean;
  previousItems: DropzoneFileItem[];
}) {
  return multiple ? [...previousItems, ...acceptedItems] : acceptedItems;
}

function createDropzoneFileId(file: File): string {
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${file.name}-${file.size}-${file.lastModified}-${uniqueId}`;
}

function hasDraggedFiles(
  dataTransfer:
    | Pick<DataTransfer, "items" | "types" | "files">
    | null
    | undefined,
): boolean {
  if (!dataTransfer) return false;
  if (dataTransfer.items?.length) {
    return Array.from(dataTransfer.items).some((item) => item.kind === "file");
  }

  return (
    Array.from(dataTransfer.types ?? []).includes("Files") ||
    (dataTransfer.files?.length ?? 0) > 0
  );
}

function composeEventHandlers<Event extends { defaultPrevented: boolean }>(
  externalHandler: ((event: Event) => void) | undefined,
  internalHandler: (event: Event) => void,
) {
  return (event: Event) => {
    externalHandler?.(event);
    if (!event.defaultPrevented) internalHandler(event);
  };
}

function composeRefs<T>(
  internalRef: React.MutableRefObject<T | null>,
  externalRef: React.Ref<T> | undefined,
) {
  return (node: T | null) => {
    internalRef.current = node;
    if (!externalRef) return;
    if (typeof externalRef === "function") {
      externalRef(node);
      return;
    }
    externalRef.current = node;
  };
}
