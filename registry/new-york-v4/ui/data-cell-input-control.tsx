"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  useDataCellOpeningContext,
  type DataCellActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-activation";
import { dataCellDisplayClass } from "@/registry/new-york-v4/ui/data-cell-classes";
import type { DataCellInputControlProps } from "@/registry/new-york-v4/ui/data-cell-control-contract";
import {
  formatDataCellEditValue,
  getDataCellValueMeta,
  parseDataCellInputValue,
} from "@/registry/new-york-v4/ui/data-cell-format";
import { getDataCellTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test";
import type {
  DataCellKind,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types";

function focusDataCellTextInput(
  input: HTMLInputElement | null,
  activationSource: DataCellActivationSource | undefined,
) {
  if (!input) return null;
  input.focus({ preventScroll: true });

  if (input.type !== "text" && input.type !== "search") return;

  const selectionIndex =
    activationSource?.kind === "pointer"
      ? (activationSource.selectionOffset ??
        getDataCellTextSelectionOffset({
          clientX: activationSource.clientX,
          input,
          value: input.value,
        }))
      : input.value.length;
  input.setSelectionRange(selectionIndex, selectionIndex);
}

function initialInputValueForActivation({
  activationSource,
  kind,
  value,
}: {
  activationSource: DataCellActivationSource | undefined;
  kind: DataCellKind;
  value: DataCellValue;
}) {
  if (
    activationSource?.kind !== "keyboard" ||
    activationSource.key.length !== 1
  ) {
    return formatDataCellEditValue(kind, value);
  }
  if (kind === "text") return activationSource.key;
  if (
    (kind === "number" || kind === "integer") &&
    /^[0-9.+-]$/.test(activationSource.key)
  ) {
    return activationSource.key;
  }
  return formatDataCellEditValue(kind, value);
}

export function DataCellInputControl({
  kind,
  value,
  disabled = false,
  name,
  placeholder,
  className,
  draft,
  autoFocus,
  activationSource,
  session,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onMouseUp,
  onDoubleClick,
  ...props
}: DataCellInputControlProps) {
  const initialInputValue = initialInputValueForActivation({
    activationSource,
    kind,
    value,
  });
  const [uncontrolledDraftValue, setUncontrolledDraftValue] =
    React.useState(initialInputValue);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const initialInputValueRef = React.useRef(initialInputValue);
  const lastInputValueRef = React.useRef(initialInputValue);
  const inputValue = draft?.value ?? uncontrolledDraftValue;
  const openingContext = useDataCellOpeningContext(activationSource, {
    enabled: activationSource?.kind === "pointer",
    releaseAfterMicrotask: true,
  });
  const isDirty = React.useCallback(
    () => lastInputValueRef.current !== initialInputValueRef.current,
    [],
  );

  React.useEffect(() => {
    if (draft?.value !== undefined) return;
    setUncontrolledDraftValue(
      initialInputValueForActivation({
        activationSource,
        kind,
        value,
      }),
    );
  }, [activationSource, draft?.value, kind, value]);

  React.useEffect(() => {
    lastInputValueRef.current = inputValue;
  }, [inputValue]);

  React.useLayoutEffect(() => {
    if (!autoFocus && !activationSource) return;
    focusDataCellTextInput(inputRef.current, activationSource);
  }, [activationSource, autoFocus]);

  const commitCurrentInputValue = React.useCallback(
    (
      input: HTMLInputElement | null,
      {
        endEditing = true,
        markFinished = true,
        onlyIfChanged = false,
      }: {
        endEditing?: boolean;
        markFinished?: boolean;
        onlyIfChanged?: boolean;
      } = {},
    ) => {
      const rawValue = input?.value ?? lastInputValueRef.current;
      const commitValue = parseDataCellInputValue({
        kind,
        value: rawValue,
        dateTimeZone: "local",
        previousValue: value,
      });
      session.commit(
        commitValue,
        getDataCellValueMeta({
          kind,
          value: rawValue,
          isBadInput: input?.validity.badInput ?? false,
        }),
        {
          endEditing,
          markFinished,
          shouldCommit: onlyIfChanged ? isDirty : undefined,
        },
      );
    },
    [isDirty, kind, session, value],
  );
  const commitCurrentInputValueRef = React.useRef(commitCurrentInputValue);

  React.useEffect(() => {
    commitCurrentInputValueRef.current = commitCurrentInputValue;
  }, [commitCurrentInputValue]);

  React.useEffect(
    () => () => {
      commitCurrentInputValueRef.current(inputRef.current, {
        endEditing: false,
        markFinished: false,
        onlyIfChanged: true,
      });
    },
    [],
  );

  const inputType = inputTypeForDataCell(kind);
  const {
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...rootProps
  } = props;

  return (
    <Input
      ref={inputRef}
      {...rootProps}
      type={inputType}
      className={cn(
        dataCellDisplayClass,
        disabled && "pointer-events-none opacity-64",
        className,
      )}
      id={id}
      name={name}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      data-kind={kind}
      data-mode="edit"
      value={inputValue}
      disabled={disabled}
      unstyled
      nativeInput
      inputMode={
        kind === "integer"
          ? "numeric"
          : kind === "number"
            ? "decimal"
            : undefined
      }
      step={kind === "integer" ? 1 : kind === "number" ? "any" : undefined}
      placeholder={placeholder}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        lastInputValueRef.current = nextValue;
        if (draft?.value === undefined) setUncontrolledDraftValue(nextValue);
        draft?.onChange?.(
          nextValue,
          getDataCellValueMeta({
            kind,
            value: nextValue,
            isBadInput: event.currentTarget.validity.badInput,
          }),
        );
      }}
      onFocus={onFocus}
      onBlur={(event) => {
        const rawValue = event.currentTarget.value;
        if (
          openingContext.shouldCancelDismiss({ kind: "focus-out" }) &&
          rawValue === initialInputValueRef.current
        ) {
          onBlur?.(event);
          return;
        }
        commitCurrentInputValue(event.currentTarget);
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter") {
          commitCurrentInputValue(event.currentTarget);
          event.currentTarget.blur();
          event.preventDefault();
          return;
        }
        if (event.key === "Escape") {
          session.cancel();
          event.currentTarget.blur();
          event.preventDefault();
          return;
        }
      }}
      onMouseUp={(event) => {
        onMouseUp?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
      }}
      onDoubleClick={onDoubleClick}
    />
  );
}

function inputTypeForDataCell(
  kind: DataCellKind,
): React.HTMLInputTypeAttribute {
  if (kind === "number" || kind === "integer") return "number";
  return "text";
}
