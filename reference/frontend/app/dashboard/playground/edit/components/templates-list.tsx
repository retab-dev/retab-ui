"use client";

import { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/app/dashboard/shared/hooks/use-debounce";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ArrowUpWideNarrowIcon,
  ArrowDownWideNarrowIcon,
  MoreVertical,
  Trash2,
  Loader2,
  FileText,
  LayoutTemplate,
  Copy,
  Download,
} from "lucide-react";
import { apiClient } from "@/app/shared/api/client";
import { toast } from "sonner";
import { EditTemplateThumbnail } from "./edit-template-thumbnail";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useEditTemplateList,
  useDeleteEditTemplate,
  useDuplicateEditTemplate,
} from "@/app/dashboard/widgets/queries/edit-templates";
import type { EditTemplate } from "@/types";

export interface TemplatesListProps {
  onSelectTemplate?: (template: EditTemplate) => void;
  enabled?: boolean;
  showSearch?: boolean;
  showDisplaySettings?: boolean;
  showPagination?: boolean;
  defaultLimit?: number;
  className?: string;
}

export const TemplatesList = ({
  onSelectTemplate,
  enabled = true,
  showSearch = true,
  showDisplaySettings = true,
  showPagination = true,
  defaultLimit = 10,
  className,
}: TemplatesListProps) => {
  // Pagination state
  const [templatesBefore, setTemplatesBefore] = useState<string | null>(null);
  const [templatesAfter, setTemplatesAfter] = useState<string | null>(null);

  // Display settings
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);
  const [limit, setLimit] = useState(defaultLimit);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Delete state
  const { mutateAsync: deleteTemplate } = useDeleteEditTemplate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Duplicate state
  const { mutateAsync: duplicateTemplate } = useDuplicateEditTemplate();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setTemplatesBefore(null);
    setTemplatesAfter(null);
  };

  // Query templates
  const templatesQuery = useEditTemplateList(
    {
      before: templatesBefore || undefined,
      after: templatesAfter || undefined,
      limit: limit,
      order: sortDirection,
      sort_by: sortField,
      filename: debouncedSearchQuery || undefined,
    },
    { enabled },
  );

  const templates = templatesQuery.data?.data || [];
  const templatesMetadata = templatesQuery.data?.list_metadata;

  // Sort fields config
  const sortFields = useMemo(
    () => [
      { value: "created_at", label: "Date Created" },
      { value: "name", label: "Name" },
    ],
    [],
  );

  // Pagination handlers
  const templatesNextPage = useCallback(() => {
    if (templatesMetadata?.after) {
      setTemplatesAfter(templatesMetadata.after);
      setTemplatesBefore(null);
    }
  }, [templatesMetadata]);

  const templatesPrevPage = useCallback(() => {
    if (templatesMetadata?.before) {
      setTemplatesBefore(templatesMetadata.before);
      setTemplatesAfter(null);
    }
  }, [templatesMetadata]);

  // Handle template click
  const handleTemplateClick = useCallback(
    (template: EditTemplate) => {
      if (onSelectTemplate) {
        onSelectTemplate(template);
      }
    },
    [onSelectTemplate],
  );

  // Delete handler
  const handleDeleteClick = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTemplate(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Duplicate handler
  const handleDuplicateClick = async (id: string) => {
    setDuplicatingId(id);
    try {
      await duplicateTemplate({ templateId: id });
    } finally {
      setDuplicatingId(null);
    }
  };

  // Download fillable template handler
  const handleDownloadClick = async (template: EditTemplate) => {
    setDownloadingId(template.id);
    try {
      const { data, response } = await apiClient.GET(
        "/v1/edits/templates/{template_id}/empty-form",
        { params: { path: { template_id: template.id } } },
      );

      if (!response.ok || !data) {
        throw new Error("Failed to download template");
      }

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
      a.download = data.filename || `${template.name}_fillable.pdf`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded fillable template");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Failed to download template");
    } finally {
      setDownloadingId(null);
    }
  };

  // Reset pagination (can be called externally via ref if needed)
  const _resetPagination = useCallback(() => {
    setTemplatesBefore(null);
    setTemplatesAfter(null);
  }, []);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className ?? ""}`}>
      {/* Search and Display Controls */}
      {(showSearch || showDisplaySettings) && (
        <div className="flex shrink-0 items-center justify-between gap-2 pb-4">
          {showSearch && (
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
          )}

          {showDisplaySettings && (
            <Popover
              open={isDisplayPopoverOpen}
              onOpenChange={setIsDisplayPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                  <span>Display</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="pointer-events-auto !z-[200] w-80 p-4"
                align="end"
              >
                <div className="space-y-4">
                  {/* Limit Section */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-gray-900">
                      Items per page
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[5, 10, 25, 50, 100].map((value) => (
                        <button
                          key={value}
                          onClick={() => setLimit(value)}
                          className={`rounded border px-3 py-2 text-xs transition-all ${
                            limit === value
                              ? "border-indigo-500 bg-indigo-50 font-semibold text-indigo-700"
                              : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-200" />

                  {/* Sort Section */}
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-semibold text-gray-900">
                      Sort by
                    </label>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-9 min-w-0 flex-1 justify-between text-xs"
                          >
                            <span className="truncate">
                              {sortFields.find((f) => f.value === sortField)
                                ?.label || "Select field"}
                            </span>
                            <ChevronRight className="ml-2 h-3.5 w-3.5 shrink-0 rotate-90 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="!z-[250] w-56"
                        >
                          <DropdownMenuRadioGroup
                            value={sortField}
                            onValueChange={setSortField}
                          >
                            {sortFields.map((field) => (
                              <DropdownMenuRadioItem
                                key={field.value}
                                value={field.value}
                                className="text-xs"
                              >
                                {field.label}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setSortDirection("asc")}
                          className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                            sortDirection === "asc"
                              ? "bg-indigo-50 font-medium text-indigo-700"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <ArrowUpWideNarrowIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSortDirection("desc")}
                          className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                            sortDirection === "desc"
                              ? "bg-indigo-50 font-medium text-indigo-700"
                              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <ArrowDownWideNarrowIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* Table Content */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        {templatesQuery.isLoading ? (
          <Table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow className="border-none">
                <TableHead className="text-xs text-black">Name</TableHead>
                <TableHead className="text-xs text-black">File</TableHead>
                <TableHead className="text-xs text-black">Fields</TableHead>
                <TableHead className="text-xs text-black"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i} className="h-12">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-6 shrink-0" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-6" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : templates.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8">
            <LayoutTemplate className="text-muted-foreground h-12 w-12" />
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground text-sm">
                {debouncedSearchQuery
                  ? "No templates match your search."
                  : "No templates yet."}
              </p>
              <p className="text-muted-foreground text-xs">
                Run field detection on a PDF and save it as a template.
              </p>
            </div>
          </div>
        ) : (
          <Table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "35%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "25%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableRow className="">
                <TableHead className="px-3 py-2 text-xs text-black">
                  Name
                </TableHead>
                <TableHead className="px-3 py-2 text-xs text-black">
                  File
                </TableHead>
                <TableHead className="px-3 py-2 text-xs text-black">
                  Fields
                </TableHead>
                <TableHead className="px-3 py-2 text-xs text-black"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  key={template.id}
                  className="group hover:bg-muted/30 h-12 cursor-pointer"
                  onClick={() => handleTemplateClick(template)}
                >
                  <TableCell className="px-3 text-xs whitespace-nowrap">
                    <div className="flex min-w-0 items-center gap-3">
                      {template.file?.id ? (
                        <EditTemplateThumbnail
                          fileId={template.file.id}
                          filename={template.file.filename || template.name}
                          className="h-6 w-6 shrink-0"
                        />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100">
                          <LayoutTemplate className="text-muted-foreground h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-fit max-w-full truncate align-middle font-medium">
                              {template.name}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{template.name}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate">
                            {template.file?.filename || "No file"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {template.file?.filename || "No file"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800"
                    >
                      {template.field_count ||
                        template.form_fields?.length ||
                        0}{" "}
                      fields
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 text-right">
                    <DropdownMenu
                      open={openMenuId === template.id}
                      onOpenChange={(open) =>
                        setOpenMenuId(open ? template.id : null)
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="iconSm"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                          disabled={
                            deletingId === template.id ||
                            duplicatingId === template.id ||
                            downloadingId === template.id
                          }
                        >
                          {deletingId === template.id ||
                          duplicatingId === template.id ||
                          downloadingId === template.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MoreVertical className="text-muted-foreground h-3.5 w-3.5" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleDownloadClick(template);
                          }}
                        >
                          <Download className="mr-2 h-3.5 w-3.5" />
                          <span>Download fillable PDF</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleDuplicateClick(template.id);
                          }}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          <span>Duplicate template</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            handleDeleteClick(template.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          <span>Delete template</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Footer */}
      {showPagination && (
        <div className="flex shrink-0 items-center justify-between pt-4">
          <div className="text-muted-foreground text-xs">
            {templates.length > 0 &&
              `Showing ${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="group px-2 text-xs"
              onClick={templatesPrevPage}
              disabled={!templatesMetadata?.before || templatesQuery.isLoading}
            >
              <ChevronLeft className="h-4 w-4 -translate-x-0.5 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-3 group-hover:opacity-0" />
              <ChevronLeft className="-ml-6 h-4 w-4 translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-0 group-hover:opacity-100" />
              Prev
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="group px-2 text-xs"
              onClick={templatesNextPage}
              disabled={!templatesMetadata?.after || templatesQuery.isLoading}
            >
              Next
              <ChevronRight className="h-4 w-4 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-3 group-hover:opacity-0" />
              <ChevronRight className="-ml-6 h-4 w-4 -translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
