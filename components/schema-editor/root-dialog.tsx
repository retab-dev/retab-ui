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
  editMode?: "descriptionOnly" | "readOnly" | "editable";
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode === "readOnly" ? "View Schema" : "Edit Schema"}
          </DialogTitle>
          <DialogDescription>
            {editMode === "readOnly"
              ? "View schema title and description."
              : "Modify schema title and description."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={`${path}-title`}>Schema Title</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  This title is used by the model to understand what is being
                  extracted.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id={`${path}-title`}
              value={schemaTitle}
              onChange={(e) => setSchemaTitle(e.target.value)}
              placeholder="Enter schema title"
              disabled={editMode === "readOnly" || editMode === "descriptionOnly"}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${path}-description`}>Description</Label>
            <Textarea
              id={`${path}-description`}
              value={metadataValues.description}
              onChange={(e) =>
                setMetadataValues({
                  ...metadataValues,
                  description: e.target.value,
                })
              }
              placeholder="Add a description to your schema"
              disabled={editMode === "readOnly"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange(
                updateNodeWithMetadata(node, {
                  ...metadataValues,
                  title: schemaTitle,
                }),
              );
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
