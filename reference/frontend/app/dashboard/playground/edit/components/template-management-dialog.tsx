"use client";

import { useCallback, useState, useRef, memo } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  LayoutTemplate,
  Plus,
  Loader2,
  FileText,
  Trash,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplatesList } from "@/app/dashboard/playground/edit/components/templates-list";
import type { EditTemplate, FieldType } from "@/types";
import {
  useCreateEditTemplate,
  useUpdateEditTemplate,
} from "@/app/dashboard/widgets/queries/edit-templates";
import { TemplateEditor } from "@/app/dashboard/playground/edit/components/lazy-template-editor";
import { FormField } from "@/app/dashboard/widgets/types/edit";
import { FileUploader } from "@/app/dashboard/playground/extract/file-uploader";
import { fetchWithAuth } from "@/backend/client-auth-utils";
import { toast } from "sonner";
import VectorSquare from "@/public/icons/vector-square.svg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TemplateManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (template: EditTemplate) => void;
}

interface InferFormSchemaResponse {
  form_schema: {
    form_fields: FormField[];
  };
}

// Loading skeleton for the form fields panel
const FormFieldsSkeleton = ({
  message = "Detecting form fields...",
}: {
  message?: string;
}) => (
  <div className="space-y-3 p-4">
    <div className="mb-4 flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      <span className="text-sm text-gray-500">{message}</span>
    </div>
    {[...Array(3)].map((_, i) => (
      <div key={i} className="space-y-2 rounded-lg border p-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    ))}
  </div>
);

// Sanitize key to only allow lowercase letters, numbers, and underscores
const sanitizeKey = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^[0-9]+/, "");
};

// Clone form fields helper
const cloneFormFields = (fields: FormField[]): FormField[] =>
  fields.map((field) => ({
    ...field,
    bbox: { ...field.bbox },
  }));

// Validated number input with blur/enter validation and min value enforcement
interface ValidatedNumberInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  defaultValue: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const ValidatedNumberInput = memo(
  ({
    value,
    onChange,
    min,
    defaultValue,
    disabled,
    placeholder,
    className,
  }: ValidatedNumberInputProps) => {
    // localValue is null when not editing (we render the parent `value`); it becomes a string
    // while the user is typing, and resets back to null on commit.
    const [localValue, setLocalValue] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useMountEffect(() => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    });

    const displayValue = localValue ?? value?.toString() ?? "";

    const commit = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (localValue === null) return;
      const parsed = parseInt(localValue);
      if (isNaN(parsed) || parsed < min) {
        onChange(defaultValue);
      } else if (parsed !== value) {
        onChange(parsed);
      }
      setLocalValue(null);
    }, [localValue, min, defaultValue, value, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        commit();
      }, 2000);
    };

    const handleBlur = () => {
      commit();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        (e.target as HTMLInputElement).blur();
      }
    };

    return (
      <Input
        type="number"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={className}
        min={min}
        placeholder={placeholder}
        disabled={disabled}
      />
    );
  },
);
ValidatedNumberInput.displayName = "ValidatedNumberInput";
// Editable fields table for the create template tab
interface EditableFieldsTableProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  isDrawingMode: boolean;
  onDrawingModeChange: (isDrawing: boolean) => void;
  hoveredFieldIndex: number | null;
  onHoveredFieldChange: (index: number | null) => void;
  selectedFieldIndex: number | null;
  isDetecting?: boolean;
  isNaming?: boolean;
}

const EditableFieldsTable = ({
  fields,
  onChange,
  hoveredFieldIndex,
  onHoveredFieldChange,
  selectedFieldIndex,
  isDetecting,
  isNaming,
}: EditableFieldsTableProps) => {
  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const updateBBox = (
    index: number,
    bboxUpdates: Partial<FormField["bbox"]>,
  ) => {
    const newFields = [...fields];
    newFields[index] = {
      ...newFields[index],
      bbox: { ...newFields[index].bbox, ...bboxUpdates },
    };
    onChange(newFields);
  };

  const deleteField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
  };

  if (isDetecting || isNaming) {
    return (
      <FormFieldsSkeleton
        message={
          isDetecting ? "Detecting form fields..." : "Naming fields with AI..."
        }
      />
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100/50 px-6 py-12">
        <FileText className="mb-3 h-10 w-10 text-slate-400" />
        <p className="mb-1 font-medium text-slate-700">Template is empty</p>
        <p className="mb-4 text-center text-sm text-slate-500">
          Start by drawing bounding boxes on the PDF
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {fields.length} field{fields.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-lg border">
        <Table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col />
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow>
              <TableHead className="text-xs">Key</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-center text-xs">Cells</TableHead>
              <TableHead className="text-xs">Max</TableHead>
              <TableHead className="text-xs">Page</TableHead>
              <TableHead className="text-xs"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow
                key={index}
                className={cn(
                  "group cursor-pointer transition-colors",
                  (hoveredFieldIndex === index ||
                    selectedFieldIndex === index) &&
                    (field.type === "checkbox" ? "bg-green-50" : "bg-blue-50"),
                )}
                onMouseEnter={() => onHoveredFieldChange(index)}
                onMouseLeave={() => onHoveredFieldChange(null)}
              >
                <TableCell className="p-1">
                  <Input
                    value={field.key}
                    onChange={(e) =>
                      updateField(index, { key: sanitizeKey(e.target.value) })
                    }
                    className="h-7 border-none !text-xs shadow-none"
                    placeholder="field_name"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    value={field.description || ""}
                    onChange={(e) =>
                      updateField(index, { description: e.target.value })
                    }
                    className="h-7 border-none !text-xs shadow-none"
                    placeholder="Field description..."
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Select
                    value={field.type}
                    onValueChange={(value) =>
                      updateField(index, {
                        type: value as FieldType,
                        ...(value === "checkbox" && {
                          combing: false,
                          max_length: undefined,
                        }),
                      })
                    }
                  >
                    <SelectTrigger className="h-7 border-none !text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-1">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={field.combing || false}
                      onCheckedChange={(checked) =>
                        updateField(index, {
                          combing: !!checked,
                          max_length: checked
                            ? field.max_length || 2
                            : undefined,
                        })
                      }
                      disabled={field.type === "checkbox"}
                      className="h-4 w-4"
                    />
                  </div>
                </TableCell>
                <TableCell className="p-1">
                  <ValidatedNumberInput
                    value={field.max_length}
                    onChange={(val) => updateField(index, { max_length: val })}
                    min={2}
                    defaultValue={2}
                    className="h-7 border-none !text-xs shadow-none"
                    placeholder="-"
                    disabled={!field.combing || field.type === "checkbox"}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <ValidatedNumberInput
                    value={field.bbox.page}
                    onChange={(val) => updateBBox(index, { page: val })}
                    min={1}
                    defaultValue={1}
                    className="h-7 border-none !text-xs shadow-none"
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="text-muted-foreground hover:text-destructive h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => deleteField(index)}
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Create Template Tab Content
function CreateTemplateContent({
  onTemplateCreated,
  templateToEdit,
  onClearTemplateToEdit,
  onEditingStateChange,
  isActive,
}: {
  onTemplateCreated: (template: EditTemplate) => void;
  templateToEdit?: EditTemplate | null;
  onClearTemplateToEdit?: () => void;
  onEditingStateChange?: (isEditing: boolean) => void;
  isActive?: boolean;
}) {
  // File state
  const [file, setFile] = useState<{ file: File; buffer: ArrayBuffer } | null>(
    null,
  );

  // Template creation state
  const [templateName, setTemplateName] = useState("");
  const [createTemplateMode, setCreateTemplateMode] = useState<
    "scratch" | "ai" | null
  >(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [isShowingNameDialog, setIsShowingNameDialog] = useState(false);

  // Template editing state
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null,
  );
  const [currentTemplateName, setCurrentTemplateName] = useState<string | null>(
    null,
  );
  const [templateFields, setTemplateFields] = useState<FormField[]>([]);
  const [detectedFieldsForDisplay, setDetectedFieldsForDisplay] = useState<
    FormField[]
  >([]);
  const [templateEditorKey, setTemplateEditorKey] = useState(0);
  const [hasStartedTemplateCreation, setHasStartedTemplateCreation] =
    useState(false);

  // Processing state
  const [isDetecting, setIsDetecting] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Field interaction state
  const [editModeTab, setEditModeTab] = useState<"edit" | "draw">("edit");
  const [hoveredFieldIndex, setHoveredFieldIndex] = useState<number | null>(
    null,
  );
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(
    null,
  );

  // Mutations
  const createTemplateMutation = useCreateEditTemplate();
  const updateTemplateMutation = useUpdateEditTemplate();

  // Wrap setCurrentTemplateId so every change also notifies the parent of editing state.
  const setCurrentTemplateIdAndNotify = useCallback(
    (id: string | null) => {
      setCurrentTemplateId(id);
      if (isActive) {
        onEditingStateChange?.(id !== null);
      }
    },
    [isActive, onEditingStateChange],
  );

  // On mount (parent keys this component to remount when activation/template changes), notify
  // the parent of the current editing state and load any pre-selected template.
  useMountEffect(() => {
    if (isActive) {
      onEditingStateChange?.(currentTemplateId !== null);
    }

    if (!templateToEdit) return;

    const loadTemplate = async () => {
      setIsLoadingTemplate(true);
      try {
        if (templateToEdit.file?.id) {
          const linkResponse = await fetchWithAuth(
            `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/files/${templateToEdit.file.id}/download-link`,
            { method: "GET" },
            { timeout: 10000 },
          );

          if (linkResponse.ok) {
            const { download_url } = await linkResponse.json();
            const fileResponse = await fetch(download_url);

            if (fileResponse.ok) {
              const buffer = await fileResponse.arrayBuffer();
              const mimeType =
                templateToEdit.file.mime_type || "application/pdf";
              const blob = new Blob([buffer], { type: mimeType });
              const loadedFile = new File(
                [blob],
                templateToEdit.file.filename || "document.pdf",
                { type: mimeType },
              );

              setFile({ file: loadedFile, buffer });
              setCurrentTemplateIdAndNotify(templateToEdit.id);
              setCurrentTemplateName(templateToEdit.name);
              setTemplateFields(
                templateToEdit.form_fields?.map((f) => ({
                  ...f,
                  bbox: { ...f.bbox },
                })) || [],
              );
              setDetectedFieldsForDisplay(
                templateToEdit.form_fields?.map((f) => ({
                  ...f,
                  bbox: { ...f.bbox },
                })) || [],
              );
              setTemplateEditorKey((key) => key + 1);
              setHasStartedTemplateCreation(true);
              setEditModeTab("edit");

              toast.success(
                `Loaded template "${templateToEdit.name}" for editing`,
              );
            } else {
              toast.error("Failed to load template file");
            }
          } else {
            toast.error("Failed to get template file download link");
          }
        } else {
          toast.error("Template has no associated file");
        }
      } catch (error) {
        console.error("Error loading template:", error);
        toast.error(
          `Failed to load template: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        onClearTemplateToEdit?.();
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    void loadTemplate();
  });

  const handleFileUploaded = useCallback(
    async (uploadedFile: File, buffer: ArrayBuffer) => {
      if (
        !uploadedFile.type.includes("pdf") &&
        !uploadedFile.name.toLowerCase().endsWith(".pdf")
      ) {
        toast.error("Only PDF files are supported for template creation.");
        return;
      }

      setFile({ file: uploadedFile, buffer });
      setTemplateFields([]);
      setDetectedFieldsForDisplay([]);
      setTemplateEditorKey((key) => key + 1);
      setCurrentTemplateIdAndNotify(null);
      setCurrentTemplateName(null);
      setEditModeTab("edit");
      setHasStartedTemplateCreation(false);
    },
    [setCurrentTemplateIdAndNotify],
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setTemplateFields([]);
    setDetectedFieldsForDisplay([]);
    setCurrentTemplateIdAndNotify(null);
    setCurrentTemplateName(null);
    setHasStartedTemplateCreation(false);
    setTemplateName("");
    onClearTemplateToEdit?.();
  }, [onClearTemplateToEdit, setCurrentTemplateIdAndNotify]);

  const handleOpenCreateTemplateDialog = (mode: "scratch" | "ai") => {
    if (!file) {
      toast.error("Please upload a PDF file first");
      return;
    }
    setCreateTemplateMode(mode);
    setTemplateName(file.file.name.replace(/\.pdf$/i, ""));
    setIsShowingNameDialog(true);
  };

  const handleCreateTemplate = async () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast.error("Template name is required");
      return;
    }
    if (!file) {
      toast.error("A PDF file is required to create a template");
      return;
    }

    setIsCreatingTemplate(true);

    try {
      const base64Data = Buffer.from(file.buffer).toString("base64");

      const createdTemplate = await createTemplateMutation.mutateAsync({
        name: trimmedName,
        document: {
          filename: file.file.name,
          url: `data:application/pdf;base64,${base64Data}`,
        },
        form_fields: [],
      });

      setCurrentTemplateIdAndNotify(createdTemplate.id);
      setCurrentTemplateName(createdTemplate.name);
      setTemplateFields([]);
      setDetectedFieldsForDisplay([]);
      setTemplateEditorKey((key) => key + 1);
      setHasStartedTemplateCreation(true);
      setIsShowingNameDialog(false);

      if (createTemplateMode === "scratch") {
        setEditModeTab("draw");
        toast.success(
          `Template "${trimmedName}" created. Draw bounding boxes to define form fields.`,
        );
      } else if (createTemplateMode === "ai") {
        toast.success(
          `Template "${trimmedName}" created. Detecting form fields...`,
        );
        await runInferFormSchemaForTemplate(createdTemplate.id);
      }
    } catch (error) {
      console.error("Create template error:", error);
      toast.error(
        `Failed to create template: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const runInferFormSchemaForTemplate = async (templateId: string) => {
    if (!file) {
      toast.error("Please upload a PDF file first");
      return;
    }

    setIsDetecting(true);
    setTemplateFields([]);
    setDetectedFieldsForDisplay([]);

    const base64Data = Buffer.from(file.buffer).toString("base64");
    const documentPayload = {
      filename: file.file.name,
      url: `data:application/pdf;base64,${base64Data}`,
    };

    try {
      // Step 1: Fast detection
      const fastResponse = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits/templates/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: documentPayload,
            confidence: 0.135,
          }),
        },
        { timeout: 60000 },
      );

      if (!fastResponse.ok) {
        throw new Error(`Fast detection failed: ${fastResponse.statusText}`);
      }

      const fastResult: InferFormSchemaResponse = await fastResponse.json();
      const detectedFields = cloneFormFields(
        fastResult.form_schema.form_fields,
      );

      setDetectedFieldsForDisplay(detectedFields);
      setTemplateEditorKey((key) => key + 1);
      toast.success(
        `Detected ${detectedFields.length} form fields. Naming fields...`,
      );

      setIsDetecting(false);
      setIsNaming(true);

      // Step 2: LLM naming
      const response = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits/templates/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: documentPayload }),
        },
        { timeout: 120000 },
      );

      if (!response.ok) {
        throw new Error(`Field naming failed: ${response.statusText}`);
      }

      const result: InferFormSchemaResponse = await response.json();
      const namedFields = cloneFormFields(result.form_schema.form_fields);

      setTemplateFields(namedFields);
      setDetectedFieldsForDisplay(namedFields);
      setTemplateEditorKey((key) => key + 1);

      // Update the template with the fields
      await updateTemplateMutation.mutateAsync({
        templateId,
        form_fields: namedFields,
      });

      toast.success(
        `Named ${result.form_schema.form_fields.length} form fields`,
      );
    } catch (error) {
      console.error("Inference error:", error);
      toast.error(
        `Field detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setTemplateFields(detectedFieldsForDisplay);
    } finally {
      setIsNaming(false);
      setIsDetecting(false);
    }
  };

  const handleTemplateFieldsChange = useCallback(
    async (newFields: FormField[]) => {
      // Optimistic update for immediate feedback
      setTemplateFields(newFields);
      setDetectedFieldsForDisplay(newFields);

      if (currentTemplateId) {
        try {
          const updatedTemplate = await updateTemplateMutation.mutateAsync({
            templateId: currentTemplateId,
            form_fields: newFields,
          });
          // Sync with backend's sorted data (fields are sorted by position on the server)
          if (updatedTemplate.form_fields) {
            setTemplateFields(updatedTemplate.form_fields);
            setDetectedFieldsForDisplay(updatedTemplate.form_fields);
          }
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }
    },
    [currentTemplateId, updateTemplateMutation],
  );

  const _handleFinishTemplate = useCallback(async () => {
    if (!currentTemplateId) return;

    try {
      // Fetch the final template data
      const response = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits/templates/${currentTemplateId}`,
        { method: "GET" },
        { timeout: 10000 },
      );

      if (response.ok) {
        const template = await response.json();
        onTemplateCreated(template);
        toast.success(
          `Template "${currentTemplateName}" saved with ${templateFields.length} fields`,
        );
      }
    } catch (error) {
      console.error("Error fetching template:", error);
      onTemplateCreated({
        id: currentTemplateId,
        name: currentTemplateName || "Untitled",
      } as EditTemplate);
    }
  }, [
    currentTemplateId,
    currentTemplateName,
    templateFields.length,
    onTemplateCreated,
  ]);

  const handleDownloadFillableTemplate = useCallback(async () => {
    if (!currentTemplateId) return;

    setIsDownloading(true);
    try {
      const response = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/v1/edits/templates/${currentTemplateId}/empty-form`,
        { method: "GET" },
      );

      if (!response.ok) {
        throw new Error("Failed to download template");
      }

      const data = await response.json();

      // Extract base64 PDF from the data URL
      const base64Part = data.url?.split(",")[1];
      if (!base64Part) {
        throw new Error("Invalid response format");
      }

      // Convert base64 to blob
      const binaryString = atob(base64Part);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        data.filename || `${currentTemplateName || "template"}_fillable.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded fillable template");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    } finally {
      setIsDownloading(false);
    }
  }, [currentTemplateId, currentTemplateName]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      {/* Loading overlay when loading a template */}
      {isLoadingTemplate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <span className="text-sm text-gray-500">Loading template...</span>
          </div>
        </div>
      )}
      {!hasStartedTemplateCreation ? (
        // Initial state - upload and choose creation mode
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
          {/* Left: PDF Upload/Preview */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-500">
                PDF Document
              </Label>
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500 hover:text-red-600"
                  onClick={clearFile}
                >
                  <Trash className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50/50">
              {file ? (
                <TemplateEditor
                  key={templateEditorKey}
                  fields={[]}
                  onChange={() => {}}
                  pdfBuffer={file.buffer}
                  readonly={true}
                  isDrawingMode={false}
                  onDrawingComplete={() => {}}
                  hoveredFieldIndex={null}
                  selectedFieldIndex={null}
                  onSelectedFieldChange={() => {}}
                />
              ) : (
                <FileUploader
                  onFileUploaded={handleFileUploaded}
                  multiple={false}
                />
              )}
            </div>
          </div>

          {/* Right: Creation mode selection */}
          <div className="flex min-h-0 flex-col gap-4">
            <div className="pt-4 text-center">
              <h3 className="mb-1 text-base font-medium text-gray-900">
                Create a Template
              </h3>
              <p className="text-xs text-gray-500">
                Upload a PDF and choose how to define the form fields
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 px-2">
              <Button
                variant="outline"
                className="flex h-auto flex-col items-start gap-1 border-2 px-4 py-3 text-left hover:border-gray-300 hover:bg-gray-50"
                onClick={() => handleOpenCreateTemplateDialog("scratch")}
                disabled={!file}
              >
                <div className="flex items-center gap-3">
                  <VectorSquare className="h-5 w-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-900">
                    Create from scratch
                  </span>
                </div>
                <span className="pl-8 text-xs text-gray-500">
                  Manually draw bounding boxes
                </span>
              </Button>

              <Button
                className="flex h-auto flex-col items-start gap-1 bg-gray-900 px-4 py-3 text-left hover:bg-gray-800"
                onClick={() => handleOpenCreateTemplateDialog("ai")}
                disabled={!file}
              >
                <div className="flex items-center gap-3">
                  <LayoutTemplate className="h-5 w-5" />
                  <span className="text-sm font-medium">Generate with AI</span>
                </div>
                <span className="pl-8 text-xs text-white/70">
                  Automatically detect form fields
                </span>
              </Button>
            </div>

            {!file && (
              <p className="mt-2 text-center text-xs text-gray-400">
                Upload a PDF to get started
              </p>
            )}
          </div>
        </div>
      ) : (
        // Template editing state
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
          {/* Left: PDF Editor */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-gray-500">
                  {currentTemplateName || "Template"}
                </Label>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500"
                  onClick={handleDownloadFillableTemplate}
                  disabled={!currentTemplateId || isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-3 w-3" />
                  )}
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-gray-500"
                  onClick={clearFile}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  New
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
              {file && (
                <TemplateEditor
                  key={templateEditorKey}
                  fields={isNaming ? detectedFieldsForDisplay : templateFields}
                  onChange={handleTemplateFieldsChange}
                  pdfBuffer={file.buffer}
                  readonly={isNaming}
                  isDrawingMode={editModeTab === "draw" && !isNaming}
                  onDrawingComplete={() => {}}
                  hoveredFieldIndex={hoveredFieldIndex}
                  selectedFieldIndex={selectedFieldIndex}
                  onSelectedFieldChange={setSelectedFieldIndex}
                />
              )}
            </div>
          </div>

          {/* Right: Fields table */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Tabs
                value={editModeTab}
                onValueChange={(value) =>
                  setEditModeTab(value as "edit" | "draw")
                }
                className="p-0"
              >
                <TabsList className="flex h-7 items-center -space-x-px bg-transparent p-0">
                  <TabsTrigger
                    value="edit"
                    disabled={isDetecting}
                    className="relative h-7 overflow-hidden rounded-none border border-gray-200 bg-white px-2 text-xs font-medium text-gray-500 transition-none first:rounded-l-md last:rounded-r-md focus-visible:ring-0 data-[state=active]:z-10 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/10 data-[state=active]:text-blue-600"
                  >
                    <VectorSquare className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="draw"
                    disabled={isDetecting}
                    className="relative h-7 overflow-hidden rounded-none border border-gray-200 bg-white px-2 text-xs font-medium text-gray-500 transition-none first:rounded-l-md last:rounded-r-md focus-visible:ring-0 data-[state=active]:z-10 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/10 data-[state=active]:text-blue-600"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Draw
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <EditableFieldsTable
              fields={templateFields}
              onChange={handleTemplateFieldsChange}
              isDrawingMode={editModeTab === "draw"}
              onDrawingModeChange={(isDrawing: boolean) =>
                setEditModeTab(isDrawing ? "draw" : "edit")
              }
              hoveredFieldIndex={hoveredFieldIndex}
              onHoveredFieldChange={setHoveredFieldIndex}
              selectedFieldIndex={selectedFieldIndex}
              isDetecting={isDetecting}
              isNaming={isNaming}
            />
          </div>
        </div>
      )}

      {/* Name template dialog */}
      <Dialog
        open={isShowingNameDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isCreatingTemplate) {
            setIsShowingNameDialog(false);
            setCreateTemplateMode(null);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create template</DialogTitle>
            <DialogDescription>
              {createTemplateMode === "scratch"
                ? "Give your template a name. You'll then draw bounding boxes to define form fields."
                : "Give your template a name. AI will automatically detect form fields in your document."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Vendor onboarding"
                disabled={isCreatingTemplate}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && templateName.trim()) {
                    handleCreateTemplate();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsShowingNameDialog(false)}
              disabled={isCreatingTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={isCreatingTemplate || !templateName.trim()}
            >
              {isCreatingTemplate && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {createTemplateMode === "scratch"
                ? "Create template"
                : "Create & detect fields"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TemplateManagementDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplateManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <TemplateManagementDialogContent
          onOpenChange={onOpenChange}
          onSelectTemplate={onSelectTemplate}
        />
      ) : null}
    </Dialog>
  );
}

function TemplateManagementDialogContent({
  onOpenChange,
  onSelectTemplate,
}: Omit<TemplateManagementDialogProps, "open">) {
  const [activeTab, setActiveTab] = useState<"view" | "create">("view");
  const [templateToEdit, setTemplateToEdit] = useState<EditTemplate | null>(
    null,
  );
  const [isEditMode, setIsEditMode] = useState(false);

  // When clicking a template in the list, open it for editing
  const handleEditTemplate = useCallback((template: EditTemplate) => {
    setTemplateToEdit(template);
    setActiveTab("create");
  }, []);

  const handleClearTemplateToEdit = useCallback(() => {
    setTemplateToEdit(null);
  }, []);

  // Called by CreateTemplateContent when currentTemplateId changes
  const handleEditingStateChange = useCallback((isEditing: boolean) => {
    setIsEditMode(isEditing);
  }, []);

  const handleTemplateCreated = useCallback(
    (template: EditTemplate) => {
      if (onSelectTemplate) {
        onSelectTemplate(template);
      }
      onOpenChange(false);
    },
    [onSelectTemplate, onOpenChange],
  );

  return (
    <DialogContent className="flex h-full max-h-[100vh] min-h-0 flex-1 flex-col sm:max-w-[100vw]">
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <DialogHeader className="p-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-blue-600" />
            Manage Templates
          </DialogTitle>
          <DialogDescription>
            Select an existing template or create a new one
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const newTab = v as "view" | "create";
            setActiveTab(newTab);
            if (newTab === "view") {
              setIsEditMode(false);
            }
            if (newTab === "create" && !isEditMode) {
              setTemplateToEdit(null);
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mb-4 flex items-center -space-x-px bg-transparent p-0">
            <TabsTrigger
              value="view"
              className="relative overflow-hidden rounded-none border border-gray-200 bg-white px-6 py-2 font-medium text-gray-500 transition-none first:rounded-l-md last:rounded-r-md focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:z-10 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/10 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
            >
              <LayoutTemplate className="mr-2 h-4 w-4" />
              View Templates
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className="relative overflow-hidden rounded-none border border-gray-200 bg-white px-6 py-2 font-medium text-gray-500 transition-none first:rounded-l-md last:rounded-r-md focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:z-10 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-50/10 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isEditMode ? "Edit Template" : "Create Template"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="mt-0 flex min-h-0 flex-1">
            <TemplatesList
              onSelectTemplate={handleEditTemplate}
              enabled={activeTab === "view"}
              showSearch={true}
              showDisplaySettings={true}
              showPagination={true}
              defaultLimit={10}
            />
          </TabsContent>

          <TabsContent
            value="create"
            className="mt-0 flex min-h-0 flex-1 flex-col"
          >
            <CreateTemplateContent
              key={templateToEdit?.id ?? "new"}
              onTemplateCreated={handleTemplateCreated}
              templateToEdit={templateToEdit}
              onClearTemplateToEdit={handleClearTemplateToEdit}
              onEditingStateChange={handleEditingStateChange}
              isActive={activeTab === "create"}
            />
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter className="border-t border-gray-100">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
