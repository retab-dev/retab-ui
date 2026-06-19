"use client";

import { CloudUpload, Copy, Download } from "lucide-react";
import { toast } from "sonner";

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ImportExportMenuItems({
  node,
  onReplaceRoot,
}: {
  node: ExtendedJSONSchema7;
  onReplaceRoot: (node: ExtendedJSONSchema7) => void;
}) {
  const handleDownloadSchema = () => {
    try {
      const schemaBlob = new Blob([JSON.stringify(node, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(schemaBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = node.title
        ? `${node.title.toLowerCase().replace(/\s+/g, "-")}.json`
        : "schema.json";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Download Started", {
        description: "Your schema has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error downloading schema:", error);
      toast.error("Download Failed", {
        description: "There was an error downloading your schema.",
      });
    }
  };

  const handleUploadSchema = () => {
    try {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.style.display = "none";

      fileInput.addEventListener("change", (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();

          reader.onload = async (loadEvent) => {
            try {
              const content = loadEvent.target?.result as string;
              onReplaceRoot(JSON.parse(content));
              toast.success("Schema Uploaded", {
                description:
                  "Your schema has been uploaded and applied successfully.",
              });
            } catch (error) {
              console.error("Error parsing uploaded schema:", error);
              toast.error("Upload Failed", {
                description: "The uploaded file is not a valid JSON schema.",
              });
            }
          };

          reader.readAsText(file);
        }

        document.body.removeChild(fileInput);
      });

      document.body.appendChild(fileInput);
      fileInput.click();
    } catch (error) {
      console.error("Error uploading schema:", error);
      toast.error("Upload Failed", {
        description: "There was an error uploading your schema.",
      });
    }
  };

  const handleCopy = () => {
    try {
      const formattedSchema = JSON.stringify(node, null, 2);
      navigator.clipboard
        .writeText(formattedSchema)
        .then(() => {
          toast.success("Copied to Clipboard", {
            description: "Your schema has been copied to the clipboard.",
          });
        })
        .catch((error) => {
          console.error("Error copying to clipboard:", error);
          const textArea = document.createElement("textarea");
          textArea.value = formattedSchema;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          textArea.style.top = "-999999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          try {
            document.execCommand("copy");
            textArea.remove();
            toast.success("Copied to Clipboard", {
              description: "Your schema has been copied to the clipboard.",
            });
          } catch (copyError) {
            console.error("Unable to copy schema", copyError);
            toast.error("Copy Failed", {
              description:
                "There was an error copying your schema to the clipboard.",
            });
            textArea.remove();
          }
        });
    } catch (error) {
      console.error("Error preparing schema for copy:", error);
      toast.error("Copy Failed", {
        description: "There was an error preparing your schema for copying.",
      });
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={handleDownloadSchema}>
        <Download className="mr-2 h-4 w-4" />
        Download
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleUploadSchema}>
        <CloudUpload className="mr-2 h-4 w-4" />
        Upload
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleCopy}>
        <Copy className="mr-2 h-4 w-4" />
        Copy to clipboard
      </DropdownMenuItem>
    </>
  );
}
