import * as React from "react";
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
import { Textarea } from "@/components/ui-retab/textarea";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip";
import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { updateNodeWithMetadata } from "@/components/schema-editor/json-schema-builder";

interface RootDialogProps {
  isOpen: boolean;
  onClose: () => void;
  path: string;
  schemaTitle: string;
  setSchemaTitle: (name: string) => void;
  metadataValues: {
    title: string;
    description: string;
  };
  setMetadataValues: (values: any) => void;
  onChange: (newNode: ExtendedJSONSchema7) => void;
  node: ExtendedJSONSchema7;
  editMode?: "promptOnly" | "readOnly" | "editable";
}

export function RootDialog({
  isOpen,
  onClose,
  path,
  schemaTitle,
  setSchemaTitle,
  metadataValues,
  setMetadataValues,
  onChange,
  node,
  editMode = "editable",
}: RootDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0">
        <div className="flex-1 overflow-y-auto">
          <DialogHeader className="flex-shrink-0 p-4 pb-2">
            <DialogTitle className="text-xl font-bold">
              {editMode === "readOnly" ? "View Schema" : "Edit Schema"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editMode === "readOnly"
                ? "View schema title and description."
                : "Modify schema title and description."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4 pt-2">
            <div>
              <div className="flex flex-row items-center gap-2">
                <Label
                  htmlFor={`${path}-title`}
                  className="block text-sm font-medium text-foreground"
                >
                  Schema Title
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    This title will be used by the AI to understand what we are
                    extracting.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id={`${path}-title`}
                value={schemaTitle}
                onChange={(e) => setSchemaTitle(e.target.value)}
                className="mt-1"
                placeholder="Enter schema title"
                disabled={editMode === "readOnly" || editMode === "promptOnly"}
              />
            </div>
            <div>
              <Label
                htmlFor={`${path}-description`}
                className="block text-sm font-medium text-foreground"
              >
                Description
              </Label>
              <Textarea
                id={`${path}-description`}
                value={metadataValues.description}
                onChange={(e) =>
                  setMetadataValues({
                    ...metadataValues,
                    description: e.target.value,
                  })
                }
                className="mt-1"
                placeholder="Add a description to your schema"
                disabled={editMode === "readOnly"}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              // Create metadata update object
              const updatedMetadata = {
                ...metadataValues,
                title: schemaTitle,
              };

              // Update the root schema node with the new metadata
              onChange(updateNodeWithMetadata(node, updatedMetadata));
              onClose();
            }}
            disabled={editMode === "readOnly"}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
