import React, { useContext, useState } from "react";
import type { JSONSchema7 } from "json-schema";

import { useMountEffect } from "@/hooks/use-mount-effect";
import type { JsonTableSchemaEditMode } from "@/components/json-table/json-table-edit-modes";
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes";
import { deleteSchemaProperty } from "@/components/json-table/lib/schema-mutations";
import { PropertyEditor } from "@/components/schema-editor/property-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PopoverDialogContext = React.createContext<boolean>(false);

function schemaObject(schema: JsonTableHeaderNode["rawSchema"]): JSONSchema7 {
  return typeof schema === "object" && schema !== null ? schema : {};
}

function PopoverDialog({
  isDialog,
  ...props
}: {
  isDialog?: boolean;
} & React.ComponentProps<typeof Popover>) {
  const [isBigEnough, setIsBigEnough] = useState<boolean>(false);

  useMountEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;

    const measureAndUpdate = () => {
      const next = window.innerHeight >= 900;
      setIsBigEnough((prev) => (prev !== next ? next : prev));
    };

    const handleResize = () => {
      const now = Date.now();
      const remaining = 1000 - (now - lastRun);
      if (remaining <= 0) {
        lastRun = now;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        measureAndUpdate();
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastRun = Date.now();
          measureAndUpdate();
          timeoutId = null;
        }, remaining);
      }
    };

    measureAndUpdate();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });

  const actualIsDialog = isDialog === undefined ? !isBigEnough : isDialog;

  return (
    <PopoverDialogContext.Provider value={actualIsDialog}>
      {actualIsDialog ? (
        <Dialog {...(props as React.ComponentProps<typeof Dialog>)} />
      ) : (
        <Popover {...props} modal={true} />
      )}
    </PopoverDialogContext.Provider>
  );
}

function PopoverDialogTrigger({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  const context = useContext(PopoverDialogContext);
  return context ? (
    <DialogTrigger {...(props as React.ComponentProps<typeof DialogTrigger>)} />
  ) : (
    <PopoverTrigger {...props} />
  );
}

function PopoverDialogContent({
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const context = useContext(PopoverDialogContext);
  return context ? (
    <DialogContent
      showCloseButton={false}
      {...(props as React.ComponentProps<typeof DialogContent>)}
    />
  ) : (
    <PopoverContent {...props} />
  );
}

function PopoverDialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h4">) {
  const context = useContext(PopoverDialogContext);

  if (context) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    );
  }

  return (
    <h4 className={className} {...props}>
      {children}
    </h4>
  );
}

function PopoverDialogDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  const context = useContext(PopoverDialogContext);

  if (context) {
    return (
      <DialogDescription className={className} {...props}>
        {children}
      </DialogDescription>
    );
  }

  return (
    <p className={className} {...props}>
      {children}
    </p>
  );
}

export function HeaderSchemaMenu({
  node,
  schema,
  setSchema,
  isPublished,
  schemaEditMode,
  open,
  onOpenChange,
  children,
}: {
  node: JsonTableHeaderNode;
  schema: JSONSchema7;
  setSchema: (schema: JSONSchema7) => void;
  isPublished: boolean;
  schemaEditMode: JsonTableSchemaEditMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const deleteProperty =
    !isPublished && schemaEditMode === "editable"
      ? () => {
          if (
            confirm(
              `Are you sure you want to delete the property "${node.key}"? This action cannot be undone.`,
            )
          ) {
            setSchema(
              deleteSchemaProperty({
                schema,
                schemaPropertyPath: node.key,
              }),
            );
            onOpenChange(false);
          }
        }
      : undefined;

  return (
    <PopoverDialog open={open} onOpenChange={onOpenChange}>
      <PopoverDialogTrigger asChild>{children}</PopoverDialogTrigger>
      <PopoverDialogContent
        className="flex max-h-[80vh] w-[min(720px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        align="start"
      >
        <PopoverDialogTitle className="sr-only">
          Edit {node.label}
        </PopoverDialogTitle>
        <PopoverDialogDescription className="sr-only">
          Edit property details.
        </PopoverDialogDescription>

        <PropertyEditor
          property={schemaObject(node.rawSchema)}
          propertyKey={node.key}
          setDropdownOpen={onOpenChange}
          schema={schema}
          replaceSchema={setSchema}
          mode={schemaEditMode}
          onDelete={deleteProperty}
        />
      </PopoverDialogContent>
    </PopoverDialog>
  );
}
