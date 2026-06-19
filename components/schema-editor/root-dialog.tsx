import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RootMetadataValues = {
  title: string;
  description: string;
};

interface RootDialogProps {
  isOpen: boolean;
  onClose: () => void;
  path: string;
  schemaTitle: string;
  setSchemaTitle: (name: string) => void;
  metadataValues: RootMetadataValues;
  setMetadataValues: (values: RootMetadataValues) => void;
  onSave: (values: RootMetadataValues) => void;
  mode?: "descriptionOnly" | "readOnly" | "editable";
}

export function RootDialog({
  isOpen,
  onClose,
  path,
  schemaTitle,
  setSchemaTitle,
  metadataValues,
  setMetadataValues,
  onSave,
  mode = "editable",
}: RootDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "readOnly" ? "View Schema" : "Edit Schema"}
          </DialogTitle>
          <DialogDescription>
            {mode === "readOnly"
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
                  <Info className="text-muted-foreground size-4" />
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
              disabled={mode === "readOnly" || mode === "descriptionOnly"}
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
              disabled={mode === "readOnly"}
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
              onSave({
                ...metadataValues,
                title: schemaTitle,
              });
              onClose();
            }}
            disabled={mode === "readOnly"}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
