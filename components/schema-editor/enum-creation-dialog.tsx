import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui-retab/dialog";
import { Button } from "@/components/ui-retab/button";
import { Input } from "@/components/ui-retab/input";
import { Label } from "@/components/ui-retab/label";
import { PlusIcon, X } from "lucide-react";

interface EnumCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (enumValues: string[]) => void;
  onCancel: () => void;
}

interface EnumCreationDialogContentProps {
  onClose: () => void;
  onConfirm: (enumValues: string[]) => void;
  onCancel: () => void;
}

function EnumCreationDialogContent({
  onClose,
  onConfirm,
  onCancel,
}: EnumCreationDialogContentProps) {
  const [enumValues, setEnumValues] = useState<string[]>([]); // Start with no values
  const [newValue, setNewValue] = useState("");

  const handleAddValue = () => {
    if (newValue.trim()) {
      setEnumValues((prev) => [...prev, newValue.trim()]);
      setNewValue("");
    }
  };

  const handleAddFromEmpty = () => {
    setEnumValues((prev) => [...prev, ""]);
  };

  const handleRemoveValue = (index: number) => {
    setEnumValues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditValue = (index: number, value: string) => {
    setEnumValues((prev) => prev.map((val, i) => (i === index ? value : val)));
  };

  const handleConfirm = () => {
    // Filter out empty values
    const validValues = enumValues.filter((val) => val.trim() !== "");
    if (validValues.length > 0) {
      onConfirm(validValues);
      onClose();
    }
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const validValuesCount = enumValues.filter((val) => val.trim() !== "").length;

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Update Field</DialogTitle>
        <DialogDescription>
          Define the allowed values for this field.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label className="mb-2">
            Enabled Options
          </Label>

          {enumValues.length > 0 && (
            <div className="mb-4 space-y-2">
              {enumValues.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(e) => handleEditValue(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && value.trim()) {
                        if (index === enumValues.length - 1) {
                          handleAddFromEmpty();
                        } else {
                          // Focus next input
                          const nextInput = document.querySelector(
                            `input[data-enum-index="${index + 1}"]`,
                          ) as HTMLInputElement;
                          nextInput?.focus();
                        }
                      }
                    }}
                    className="flex-1"
                    placeholder={`Value ${index + 1}`}
                    data-enum-index={index}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-1"
                    onClick={() => handleRemoveValue(index)}
                    disabled={enumValues.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newValue.trim()) {
                  handleAddValue();
                }
              }}
              className="flex-1"
              placeholder="Add another value"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddValue}
              disabled={!newValue.trim()}
            >
              <PlusIcon className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {validValuesCount} value{validValuesCount !== 1 ? "s" : ""} defined.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleConfirm}
          disabled={validValuesCount === 0}
        >
          Update Field ({validValuesCount} value
          {validValuesCount !== 1 ? "s" : ""})
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function EnumCreationDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
}: EnumCreationDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {isOpen ? (
        <EnumCreationDialogContent
          key="enum-creation-dialog"
          onClose={onClose}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : null}
    </Dialog>
  );
}
