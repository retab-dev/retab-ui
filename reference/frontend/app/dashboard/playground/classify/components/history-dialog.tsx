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
  Tags,
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
import { Badge } from "@/components/ui/badge";
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
  useClassificationList,
  useDeleteClassification,
} from "@/app/dashboard/widgets/queries/classifications";
import type { Classification } from "@/types";
import { useCanOrganization } from "@/app/dashboard/shared/authz/authorization-checks";

export const ClassifyHistoryDialog = ({
  open,
  onOpenChange,
  onSelectClassification,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClassification?: (classification: Classification) => void;
}) => {
  // Pagination state
  const [classificationsBefore, setClassificationsBefore] = useState<
    string | null
  >(null);
  const [classificationsAfter, setClassificationsAfter] = useState<
    string | null
  >(null);

  // Display settings
  const [isDisplayPopoverOpen, setIsDisplayPopoverOpen] = useState(false);
  const [limit, setLimit] = useState(10);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Delete state. UI signaling: hide the delete affordance when the classify
  // primitive capability is absent (no distinct classification-delete policy
  // exists, so the page primitive governs history delete).
  const canDeleteClassification = useCanOrganization("rbac:primitive:classify");
  const { mutateAsync: deleteClassification } = useDeleteClassification();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Reset pagination when the user types
    setClassificationsBefore(null);
    setClassificationsAfter(null);
  };

  // Query classifications
  const classificationsQuery = useClassificationList(
    {
      before: classificationsBefore || undefined,
      after: classificationsAfter || undefined,
      limit: limit,
      order: sortField === "created_at" ? sortDirection : "desc",
      filename: debouncedSearchQuery || undefined,
    },
    { enabled: open },
  );

  const classifications = classificationsQuery.data?.data || [];
  const classificationsMetadata = classificationsQuery.data?.list_metadata;

  // Sort fields config
  const sortFields = useMemo(
    () => [
      { value: "created_at", label: "Date Created" },
      { value: "filename", label: "Filename" },
    ],
    [],
  );

  // Pagination handlers
  const classificationsNextPage = useCallback(() => {
    if (classificationsMetadata?.after) {
      setClassificationsAfter(classificationsMetadata.after);
      setClassificationsBefore(null);
    }
  }, [classificationsMetadata]);

  const classificationsPrevPage = useCallback(() => {
    if (classificationsMetadata?.before) {
      setClassificationsBefore(classificationsMetadata.before);
      setClassificationsAfter(null);
    }
  }, [classificationsMetadata]);

  // Handle classification click
  const handleClassificationClick = useCallback(
    (classification: Classification) => {
      if (onSelectClassification) {
        onSelectClassification(classification);
      }
      onOpenChange(false);
    },
    [onSelectClassification, onOpenChange],
  );

  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!canDeleteClassification) return;
    setDeleteConfirmId(id);
    setOpenMenuId(null);
  };

  const handleDeleteConfirm = async () => {
    // Fail-closed guard: never call the delete mutation without the capability.
    if (!canDeleteClassification) return;
    if (!deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    try {
      await deleteClassification(deleteConfirmId);
      setDeleteConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  };

  // Get file icon
  const getFileIcon = () => {
    return <FileText className="text-muted-foreground h-4 w-4" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] min-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Classification History</DialogTitle>
            <DialogDescription className="sr-only">
              View and load your previous classification results
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
            {classificationsQuery.isLoading ? (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow className="border-none">
                    <TableHead className="text-xs text-black">File</TableHead>
                    <TableHead className="text-xs text-black">Model</TableHead>
                    <TableHead className="text-xs text-black">
                      Classification
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
                        <Skeleton className="h-4 w-20" />
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
            ) : classifications.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-4 p-8">
                <div className="space-y-2 text-center">
                  <p className="text-muted-foreground text-sm">
                    {debouncedSearchQuery
                      ? "No classifications match your search."
                      : "No classifications yet."}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Run a classification to see results here.
                  </p>
                </div>
              </div>
            ) : (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: "35%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "10%" }} />
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
                      Classification
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black">
                      Date
                    </TableHead>
                    <TableHead className="px-3 py-2 text-xs text-black"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classifications.map((classification) => (
                    <TableRow
                      key={classification.id}
                      className="group hover:bg-muted/30 h-12 cursor-pointer"
                      onClick={() => handleClassificationClick(classification)}
                    >
                      <TableCell className="px-3 text-xs whitespace-nowrap">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100">
                            {getFileIcon()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block w-fit max-w-full truncate align-middle font-medium">
                                  {classification.file?.filename || "Unknown"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {classification.file?.filename || "Unknown"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        <span className="font-mono text-xs">
                          {classification.model || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className="bg-teal-100 text-teal-800"
                        >
                          <Tags className="mr-1 h-3 w-3" />
                          {classification.output?.category || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-3 text-xs whitespace-nowrap">
                        {new Date(
                          classification.created_at ?? "",
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3 text-right">
                        {canDeleteClassification && (
                          <Popover
                            open={openMenuId === classification.id}
                            onOpenChange={(open) =>
                              setOpenMenuId(open ? classification.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="iconSm"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                                disabled={deletingId === classification.id}
                              >
                                {deletingId === classification.id ? (
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
                                  handleDeleteClick(e, classification.id)
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete classification</span>
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
              {classifications.length > 0 &&
                `Showing ${classifications.length} classification${classifications.length !== 1 ? "s" : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="group px-2 text-xs"
                onClick={classificationsPrevPage}
                disabled={
                  !classificationsMetadata?.before ||
                  classificationsQuery.isLoading
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
                onClick={classificationsNextPage}
                disabled={
                  !classificationsMetadata?.after ||
                  classificationsQuery.isLoading
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
                Delete classification
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this classification result? This
                action cannot be undone.
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
