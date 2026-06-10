"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "@/app/dashboard/shared/hooks/use-debounce";
import { format } from "date-fns";
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
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  useExtractionList,
  useDeleteExtraction,
} from "@/app/dashboard/widgets/queries/extractions";
import { ExtractionThumbnail } from "@/app/dashboard/widgets/components/shared/extraction-thumbnail";
import type { Extraction } from "@/app/dashboard/widgets/types/extract";
import { useDashboardEnvironmentHref } from "@/app/shared/environment/use-dashboard-environment-href";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";

function logHistoryFlow(event: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return;
  }
  console.info(`[extract-flow] ${event}`, details);
}

interface HistoryDialogProps {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExtraction?: (extraction: Extraction) => void;
}

export const HistoryDialog = ({
  open,
  onOpenChange,
  onSelectExtraction,
}: HistoryDialogProps) => {
  const router = useRouter();
  const dashboardHref = useDashboardEnvironmentHref();
  const renderCountRef = useRef(0);

  // Pagination state
  const [extractionsBefore, setExtractionsBefore] = useState<string | null>(
    null,
  );
  const [extractionsAfter, setExtractionsAfter] = useState<string | null>(null);

  // Display settings
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Delete state. UI signaling: hide the delete affordance when the extract
  // primitive capability is absent (no distinct extraction-delete policy
  // exists, so the page primitive governs history delete).
  const canDeleteExtraction = useCanOrganization("rbac:primitive:extract");
  const { mutateAsync: deleteExtraction } = useDeleteExtraction();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Reset pagination when the user types
    setExtractionsBefore(null);
    setExtractionsAfter(null);
  };

  // Query extractions (no project filter for playground history)
  const extractionsQuery = useExtractionList(
    {
      before: extractionsBefore || undefined,
      after: extractionsAfter || undefined,
      limit: limit,
      order: sortField === "created_at" ? sortDirection : "desc",
      filename: debouncedSearchQuery || undefined,
    },
    { enabled: open === true },
  );

  const extractions = extractionsQuery.data?.data || [];
  const extractionsMetadata = extractionsQuery.data?.list_metadata;
  renderCountRef.current += 1;
  logHistoryFlow("HistoryDialog render", {
    renderCount: renderCountRef.current,
    open: open === true,
    isLoading: extractionsQuery.isLoading,
    isFetching: extractionsQuery.isFetching,
    extractionCount: extractions.length,
    hasBeforeCursor: Boolean(extractionsMetadata?.before),
    hasAfterCursor: Boolean(extractionsMetadata?.after),
  });

  // Sort fields config
  const sortFields = useMemo(
    () => [
      { value: "created_at", label: "Date Created" },
      { value: "filename", label: "Filename" },
    ],
    [],
  );

  // Pagination handlers
  const extractionsNextPage = useCallback(() => {
    if (extractionsMetadata?.after) {
      setExtractionsAfter(extractionsMetadata.after);
      setExtractionsBefore(null);
    }
  }, [extractionsMetadata]);

  const extractionsPrevPage = useCallback(() => {
    if (extractionsMetadata?.before) {
      setExtractionsBefore(extractionsMetadata.before);
      setExtractionsAfter(null);
    }
  }, [extractionsMetadata]);

  // Handle extraction click
  const handleExtractionClick = useCallback(
    (extraction: Extraction) => {
      if (onSelectExtraction) {
        onOpenChange(false);
        window.setTimeout(() => {
          onSelectExtraction(extraction);
        }, 0);
        return;
      }

      router.push(
        dashboardHref(
          `/dashboard/playground/extract?extraction_id=${extraction.id}`,
        ),
      );
      onOpenChange(false);
    },
    [dashboardHref, onOpenChange, onSelectExtraction, router],
  );

  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canDeleteExtraction) return;
    setDeleteConfirmId(id);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    // Fail-closed guard: never call the delete mutation without the capability.
    if (!canDeleteExtraction) return;
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    try {
      await deleteExtraction(deleteConfirmId);
      setDeleteConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[80vh] min-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>History</DialogTitle>
            <DialogDescription className="sr-only">
              View and load your previous extractions
            </DialogDescription>
          </DialogHeader>

          {/* Search and Display Controls */}
          <div className="flex items-center justify-between gap-2 px-6 pb-4">
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-3.5 w-3.5" />
              <Input
                placeholder="Search by filename..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

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
              <PopoverContent className="w-80 p-4" align="end">
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
                        <DropdownMenuContent align="start" className="w-56">
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
          </div>

          {/* Table Content */}
          <div className="min-h-0 flex-1 overflow-auto border-t border-b">
            {extractionsQuery.isLoading ? (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "45%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="border-none">
                    <TableHead className="text-xs text-black">File</TableHead>
                    <TableHead className="text-xs text-black">Model</TableHead>
                    <TableHead className="text-xs text-black">
                      Consensus
                    </TableHead>
                    <TableHead className="text-xs text-black">Date</TableHead>
                    <TableHead className="text-xs text-black"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-12">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 shrink-0" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-6" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : extractions.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8">
                <div className="space-y-2 text-center">
                  <p className="text-muted-foreground text-sm">
                    {debouncedSearchQuery
                      ? "No extractions match your search."
                      : "No extractions yet."}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Run an extraction to see results here.
                  </p>
                </div>
              </div>
            ) : (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "45%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "5%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="border-none">
                    <TableHead className="px-3 py-2 text-xs text-black">
                      File
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Model
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Consensus
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Date
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractions.map((extraction) => (
                    <TableRow
                      key={extraction.id}
                      className="group hover:bg-muted/30 h-12 cursor-pointer"
                      onClick={() => handleExtractionClick(extraction)}
                    >
                      <TableCell className="px-3 text-xs whitespace-nowrap">
                        <div className="flex min-w-0 items-center gap-3">
                          <ExtractionThumbnail
                            fileId={extraction.file?.id}
                            filename={extraction.file?.filename || "Unknown"}
                            mimeType={extraction.file?.mime_type}
                            className="h-8 w-8 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block w-fit max-w-full truncate align-middle font-medium">
                                  {extraction.file?.filename || "Unknown"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {extraction.file?.filename || "Unknown"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        <span className="font-mono text-xs">
                          {extraction.model || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        {extraction.n_consensus ?? 1}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        {new Date(extraction.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        {canDeleteExtraction && (
                          <Popover
                            open={openMenuId === extraction.id}
                            onOpenChange={(open) =>
                              setOpenMenuId(open ? extraction.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="iconSm"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                                disabled={deletingId === extraction.id}
                              >
                                {deletingId === extraction.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <MoreVertical className="text-muted-foreground h-3.5 w-3.5" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="flex w-52 flex-col gap-1 p-2"
                            >
                              <button
                                className="hover:bg-destructive/10 text-destructive flex items-center gap-2 rounded px-3 py-2 text-left text-xs"
                                onClick={(e) =>
                                  handleDeleteClick(e, extraction.id)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete extraction</span>
                              </button>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between p-4">
            <div className="text-muted-foreground text-xs">
              {extractions.length > 0 &&
                `Showing ${extractions.length} extraction${extractions.length !== 1 ? "s" : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="group px-2 text-xs"
                onClick={extractionsPrevPage}
                disabled={
                  !extractionsMetadata?.before || extractionsQuery.isLoading
                }
              >
                <ChevronLeft className="h-4 w-4 -translate-x-0.5 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-3 group-hover:opacity-0" />
                <ChevronLeft className="-ml-6 h-4 w-4 translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:-translate-x-0 group-hover:opacity-100" />
                Prev
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="group px-2 text-xs"
                onClick={extractionsNextPage}
                disabled={
                  !extractionsMetadata?.after || extractionsQuery.isLoading
                }
              >
                Next
                <ChevronRight className="h-4 w-4 opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-3 group-hover:opacity-0" />
                <ChevronRight className="-ml-6 h-4 w-4 -translate-x-2.5 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="gap-0 rounded-2xl border-none bg-gray-50 p-0 shadow-2xl">
          <div className="rounded-2xl bg-white shadow-xs">
            <AlertDialogHeader className="p-6 pb-4">
              <AlertDialogTitle className="text-lg font-medium text-slate-900">
                Delete extraction
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this extraction? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="p-4">
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
              className="group before:transtion-opacity bg-destructive hover:bg-destructive ring-destructive relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-md text-left font-medium text-white shadow-[0_1px_theme(colors.white/0.07)_inset,0_1px_3px_theme(colors.gray.900/0.2)] ring-1 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:opacity-50 before:duration-300 before:ease-[cubic-bezier(0.4,0.36,0,1)] after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-md after:bg-gradient-to-b after:from-white/10 after:from-[46%] after:to-[54%] after:mix-blend-overlay hover:opacity-80 hover:before:opacity-100"
            >
              {deletingId !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
